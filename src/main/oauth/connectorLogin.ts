import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { shell } from 'electron'
import { getClient, getGrant, removeGrant, saveClient, saveGrant } from '../store/connectorAuth'
import {
  authorizationUrl,
  canonicalResource,
  chooseScope,
  createPkce,
  discoverAuthServer,
  discoverProtectedResource,
  exchangeCode,
  needsRefresh,
  OAuthError,
  probeServer,
  randomState,
  refreshGrant,
  registerClient,
  validateCallback
} from './mcpOAuth'

/** Le temps de se connecter dans le navigateur, sans laisser un port ouvert indéfiniment. */
const LOGIN_TIMEOUT_MS = 5 * 60_000

const PAGE = (title: string, text: string): string => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${title}</title><style>body{font:15px -apple-system,sans-serif;background:#1d2026;color:#e8eaee;display:grid;place-items:center;height:100vh;margin:0}
main{text-align:center;max-width:420px}h1{font-size:20px;margin:0 0 8px}h1 span{color:#c8f031}p{color:#a5abb6;margin:0}</style></head>
<body><main><h1>${title}</h1><p>${text}</p></main></body></html>`

let current: { server: Server; cancel(): void } | null = null

/** Ouvre le port local sur 127.0.0.1, de préférence celui déjà enregistré auprès du serveur d'autorisation. */
function listen(server: Server, port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const onError = (): void => resolve(null)
    server.once('error', onError)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError)
      resolve((server.address() as AddressInfo).port)
    })
  })
}

function portOf(redirectUri: string | undefined): number {
  if (!redirectUri) return 0
  const port = Number(new URL(redirectUri).port)
  return Number.isInteger(port) && port > 0 ? port : 0
}

/**
 * Relie un connecteur à son compte : découverte, enregistrement de l'app si besoin,
 * connexion dans le navigateur du Mac (code d'autorisation + PKCE), puis jetons chiffrés.
 * Une seule connexion à la fois : en lancer une nouvelle annule la précédente.
 */
export async function loginConnector(connector: { id: string; url: string }): Promise<void> {
  current?.cancel()
  const challenge = await probeServer(fetch, connector.url)
  if (!challenge) throw new OAuthError('Ce serveur répond sans demander de connexion : il n’y a rien à autoriser.')
  const protectedResource = await discoverProtectedResource(fetch, connector.url, challenge)
  const authServer = await discoverAuthServer(fetch, protectedResource.authorizationServers[0]!)
  const resource = canonicalResource(connector.url)

  let deliver: (params: URLSearchParams) => void = () => undefined
  let fail: (error: Error) => void = () => undefined
  const callback = new Promise<URLSearchParams>((resolve, reject) => {
    deliver = resolve
    fail = reject
  })
  // Une annulation peut arriver avant qu'on attende la réponse : elle sera lue plus bas.
  callback.catch(() => undefined)
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (req.method !== 'GET' || url.pathname !== '/callback') {
      res.writeHead(404).end()
      return
    }
    const ok = url.searchParams.has('code') && !url.searchParams.has('error')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(
      ok
        ? PAGE('Connexion <span>réussie</span>', 'Tu peux fermer cet onglet et revenir à Agent Toolbox.')
        : PAGE('Connexion interrompue', 'Reviens à Agent Toolbox pour réessayer.')
    )
    deliver(url.searchParams)
  })
  const stored = getClient(authServer.issuer)
  const port = (await listen(server, portOf(stored?.redirectUri))) ?? (await listen(server, 0))
  if (port === null) throw new OAuthError("Impossible d'ouvrir le port local qui reçoit la réponse du navigateur.")

  const timer = setTimeout(() => fail(new OAuthError('La connexion n’a pas abouti à temps. Réessaie.')), LOGIN_TIMEOUT_MS)
  const close = (): void => {
    clearTimeout(timer)
    server.close()
    server.closeAllConnections()
    if (current?.server === server) current = null
  }
  current = { server, cancel: () => fail(new OAuthError('Connexion annulée.')) }

  try {
    const redirectUri = `http://127.0.0.1:${port}/callback`
    // L'identifiant d'app est lié à l'émetteur et à son adresse de retour exacte.
    const client = stored && stored.redirectUri === redirectUri ? stored : await registerClient(fetch, authServer, redirectUri)
    if (client !== stored) saveClient(client)

    const pkce = createPkce()
    const state = randomState()
    const url = authorizationUrl(authServer, client, {
      resource,
      scope: chooseScope(challenge, protectedResource, authServer),
      state,
      codeChallenge: pkce.challenge
    })
    await shell.openExternal(url)

    const code = validateCallback(await callback, { state, issuer: authServer.issuer, issRequired: authServer.issParameterSupported })
    const tokens = await exchangeCode(fetch, authServer, client, { code, verifier: pkce.verifier, resource })
    saveGrant(connector.id, {
      ...tokens,
      issuer: authServer.issuer,
      tokenEndpoint: authServer.tokenEndpoint,
      resource,
      clientId: client.clientId,
      clientSecret: client.clientSecret
    })
  } finally {
    close()
  }
}

export function logoutConnector(connectorId: string): void {
  removeGrant(connectorId)
}

export type FreshToken = { token: string } | { token: null; reconnect: boolean }

/**
 * Jeton d'accès prêt à servir, rafraîchi s'il expire bientôt. Un rafraîchissement
 * refusé efface l'autorisation : il faudra se reconnecter. Sans réseau, on tente
 * l'ancien jeton, le serveur tranchera.
 */
export async function freshAccessToken(connectorId: string): Promise<FreshToken> {
  const grant = getGrant(connectorId)
  if (!grant) return { token: null, reconnect: true }
  if (!needsRefresh(grant)) return { token: grant.accessToken }
  try {
    const renewed = await refreshGrant(fetch, grant)
    saveGrant(connectorId, renewed)
    return { token: renewed.accessToken }
  } catch (error) {
    if (error instanceof OAuthError && error.message === 'invalid_grant') {
      removeGrant(connectorId)
      return { token: null, reconnect: true }
    }
    return { token: grant.accessToken }
  }
}

/** Le serveur demande-t-il une connexion OAuth ? Sert à choisir le mode d'un nouveau connecteur. */
export async function offersOAuth(url: string): Promise<boolean> {
  try {
    const challenge = await probeServer(fetch, url)
    if (!challenge) return false
    await discoverProtectedResource(fetch, url, challenge)
    return true
  } catch {
    return false
  }
}
