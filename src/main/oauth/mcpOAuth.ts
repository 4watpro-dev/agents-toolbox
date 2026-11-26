// Autorisation OAuth des connecteurs MCP, d'après la spécification MCP 2026-07-28
// (basic/authorization) : découverte RFC 9728 puis RFC 8414 / OpenID, enregistrement
// dynamique RFC 7591 (application native), code d'autorisation avec PKCE S256,
// paramètre `resource` (RFC 8707), contrôle de `iss` au retour (RFC 9207).
// Aucune dépendance à Electron : tout passe par `fetch`, injectable pour les tests.

import { createHash, randomBytes } from 'node:crypto'

export type Fetch = typeof fetch

const TIMEOUT_MS = 15_000
/** Un jeton qui expire dans moins d'une minute est rafraîchi avant usage. */
const EXPIRY_MARGIN_MS = 60_000
const PROTOCOL_VERSION = '2026-07-28'

export class OAuthError extends Error {}

/**
 * Identité publique de l'app (Client ID Metadata Document) : un document servi par la
 * landing, qui donne au serveur d'autorisation le nom, le logo et les seuls retours permis.
 * Méthode recommandée par la spécification ; l'enregistrement dynamique reste en secours.
 */
export const CIMD_CLIENT_ID = 'https://agenttoolbox.netlify.app/oauth/client.json'
/** Ports de retour déclarés dans ce document, essayés dans l'ordre. */
export const CIMD_PORTS = [47215, 47216, 47217] as const

export const loopbackRedirect = (port: number): string => `http://127.0.0.1:${port}/callback`

export interface Challenge {
  resourceMetadata: string | null
  scope: string | null
}

export interface ProtectedResource {
  resource: string
  authorizationServers: string[]
  scopesSupported: string[]
}

export interface AuthServer {
  issuer: string
  authorizationEndpoint: string
  tokenEndpoint: string
  registrationEndpoint: string | null
  /** Révocation des jetons (RFC 7009), si le serveur la propose. */
  revocationEndpoint: string | null
  scopesSupported: string[]
  issParameterSupported: boolean
  /** Le serveur accepte une adresse HTTPS comme identifiant d'app (CIMD). */
  cimdSupported: boolean
}

export interface ClientRegistration {
  issuer: string
  clientId: string
  clientSecret: string | null
  redirectUri: string
}

export interface TokenSet {
  accessToken: string
  refreshToken: string | null
  /** Horodatage en millisecondes, `null` si le serveur ne l'indique pas. */
  expiresAt: number | null
  scope: string | null
}

/** Tout ce qu'il faut pour rafraîchir le jeton d'un connecteur sans refaire la découverte. */
export interface OAuthGrant extends TokenSet {
  issuer: string
  tokenEndpoint: string
  resource: string
  clientId: string
  clientSecret: string | null
}

async function request(fetchImpl: Fetch, url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new OAuthError(`Impossible de joindre ${new URL(url).host}. Vérifie ta connexion.`)
  }
}

function requireHttps(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new OAuthError(`Réponse du serveur incomplète : ${what} manquant.`)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new OAuthError(`Réponse du serveur invalide : ${what}.`)
  }
  if (url.protocol !== 'https:') throw new OAuthError(`Le serveur d'autorisation doit utiliser https (${what}).`)
  return value
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])

/** Adresse canonique du serveur MCP (RFC 8707) : schéma et hôte en minuscules, sans fragment ni barre finale. */
export function canonicalResource(serverUrl: string): string {
  const url = new URL(serverUrl)
  url.hash = ''
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`
}

/** Paramètres du défi `Bearer` d'un en-tête WWW-Authenticate (RFC 6750, RFC 9728 §5.1). */
export function parseBearerChallenge(header: string | null): Challenge | null {
  if (!header) return null
  const start = header.search(/(^|,\s*)Bearer(\s|$)/i)
  if (start === -1) return null
  const rest = header.slice(header.toLowerCase().indexOf('bearer', start) + 6)
  const params: Record<string, string> = {}
  const pattern = /\s*([A-Za-z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]+))\s*(,|$)/y
  let match: RegExpExecArray | null
  while ((match = pattern.exec(rest))) {
    params[match[1]!.toLowerCase()] = match[2] !== undefined ? match[2].replace(/\\(.)/g, '$1') : match[3]!
    if (!match[4]) break
  }
  return { resourceMetadata: params['resource_metadata'] ?? null, scope: params['scope'] ?? null }
}

/**
 * Requête MCP sans jeton. `null` : le serveur répond sans demander d'autorisation.
 * Sinon, le défi du 401 (éventuellement vide : on cherchera alors les adresses connues).
 */
export async function probeServer(fetchImpl: Fetch, serverUrl: string): Promise<Challenge | null> {
  const response = await request(fetchImpl, serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': PROTOCOL_VERSION },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'Agent Toolbox', version: '1.0.0' } }
    })
  })
  void response.body?.cancel()
  if (response.status !== 401) return null
  return parseBearerChallenge(response.headers.get('www-authenticate')) ?? { resourceMetadata: null, scope: null }
}

async function getJson(fetchImpl: Fetch, url: string): Promise<Record<string, unknown> | null> {
  const response = await request(fetchImpl, url, { headers: { Accept: 'application/json', 'MCP-Protocol-Version': PROTOCOL_VERSION } })
  if (!response.ok) {
    void response.body?.cancel()
    return null
  }
  try {
    const body = (await response.json()) as unknown
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Métadonnées de la ressource protégée : adresse du défi, sinon chemin de l'endpoint, sinon racine. */
export async function discoverProtectedResource(fetchImpl: Fetch, serverUrl: string, challenge: Challenge): Promise<ProtectedResource> {
  const url = new URL(serverUrl)
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
  const candidates = challenge.resourceMetadata
    ? [challenge.resourceMetadata]
    : [...(path ? [`${url.origin}/.well-known/oauth-protected-resource${path}`] : []), `${url.origin}/.well-known/oauth-protected-resource`]
  for (const candidate of candidates) {
    const metadata = await getJson(fetchImpl, requireHttpsOrLocal(candidate))
    if (!metadata) continue
    const resource = typeof metadata['resource'] === 'string' ? metadata['resource'] : null
    // RFC 9728 §3.3 : le document doit décrire ce serveur-là, sinon il est ignoré.
    if (!resource || canonicalResource(resource) !== canonicalResource(serverUrl)) {
      throw new OAuthError("Les métadonnées d'autorisation décrivent un autre serveur : connexion refusée.")
    }
    const authorizationServers = strings(metadata['authorization_servers'])
    if (authorizationServers.length === 0) throw new OAuthError("Ce serveur n'indique aucun serveur d'autorisation.")
    return { resource, authorizationServers, scopesSupported: strings(metadata['scopes_supported']) }
  }
  throw new OAuthError("Ce serveur demande une autorisation mais ne publie pas comment l'obtenir.")
}

/** Un serveur MCP local (http://localhost) peut servir ses métadonnées sans https ; tout le reste l'exige. */
function requireHttpsOrLocal(value: string): string {
  const url = new URL(value)
  if (url.protocol === 'https:') return value
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return value
  throw new OAuthError('Les métadonnées d’autorisation doivent être servies en https.')
}

/** Adresses à essayer pour un émetteur, dans l'ordre imposé par la spécification. */
export function authServerMetadataUrls(issuer: string): string[] {
  const url = new URL(issuer)
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
  if (!path) return [`${url.origin}/.well-known/oauth-authorization-server`, `${url.origin}/.well-known/openid-configuration`]
  return [
    `${url.origin}/.well-known/oauth-authorization-server${path}`,
    `${url.origin}/.well-known/openid-configuration${path}`,
    `${url.origin}${path}/.well-known/openid-configuration`
  ]
}

export async function discoverAuthServer(fetchImpl: Fetch, issuer: string): Promise<AuthServer> {
  requireHttps(issuer, 'émetteur')
  for (const candidate of authServerMetadataUrls(issuer)) {
    const metadata = await getJson(fetchImpl, candidate)
    if (!metadata) continue
    // RFC 8414 §3.3 : un document dont l'émetteur diffère ne doit pas servir.
    if (metadata['issuer'] !== issuer) throw new OAuthError("Le serveur d'autorisation ne s'identifie pas comme prévu : connexion refusée.")
    // Sans S256 annoncé, PKCE n'est pas garanti : la spécification interdit de continuer.
    if (!strings(metadata['code_challenge_methods_supported']).includes('S256')) {
      throw new OAuthError("Ce serveur d'autorisation ne prend pas en charge PKCE (S256) : connexion refusée.")
    }
    return {
      issuer,
      authorizationEndpoint: requireHttps(metadata['authorization_endpoint'], "adresse d'autorisation"),
      tokenEndpoint: requireHttps(metadata['token_endpoint'], 'adresse des jetons'),
      registrationEndpoint: metadata['registration_endpoint'] ? requireHttps(metadata['registration_endpoint'], "adresse d'enregistrement") : null,
      revocationEndpoint: metadata['revocation_endpoint'] ? requireHttps(metadata['revocation_endpoint'], 'adresse de révocation') : null,
      scopesSupported: strings(metadata['scopes_supported']),
      issParameterSupported: metadata['authorization_response_iss_parameter_supported'] === true,
      cimdSupported: metadata['client_id_metadata_document_supported'] === true
    }
  }
  throw new OAuthError("Impossible de trouver la configuration du serveur d'autorisation.")
}

/** Enregistrement dynamique (RFC 7591), en application native avec retour sur la boucle locale. */
export async function registerClient(fetchImpl: Fetch, server: AuthServer, redirectUri: string): Promise<ClientRegistration> {
  if (!server.registrationEndpoint) {
    throw new OAuthError("Ce serveur n'accepte pas l'enregistrement automatique d'une app : il faudrait un identifiant client fourni par l'éditeur.")
  }
  const response = await request(fetchImpl, server.registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_name: 'Agent Toolbox',
      application_type: 'native',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    })
  })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || typeof body['client_id'] !== 'string') {
    throw new OAuthError(`Le serveur a refusé d'enregistrer l'app${typeof body['error_description'] === 'string' ? ` : ${body['error_description']}` : '.'}`)
  }
  return {
    issuer: server.issuer,
    clientId: body['client_id'],
    clientSecret: typeof body['client_secret'] === 'string' ? body['client_secret'] : null,
    redirectUri
  }
}

/** Identifiant d'app CIMD : rien à enregistrer, le serveur lit le document lui-même. */
export function cimdClient(server: AuthServer, port: (typeof CIMD_PORTS)[number]): ClientRegistration {
  return { issuer: server.issuer, clientId: CIMD_CLIENT_ID, clientSecret: null, redirectUri: loopbackRedirect(port) }
}

const base64url = (buffer: Buffer): string => buffer.toString('base64url')

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32))
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) }
}

export const randomState = (): string => base64url(randomBytes(24))

/**
 * Portée demandée : celle du défi en priorité, sinon celles de la ressource.
 * `offline_access` s'ajoute quand le serveur d'autorisation l'annonce, pour obtenir un jeton de rafraîchissement.
 */
export function chooseScope(challenge: Challenge, resource: ProtectedResource, server: AuthServer): string | null {
  const scopes = new Set((challenge.scope ?? resource.scopesSupported.join(' ')).split(/\s+/).filter(Boolean))
  if (server.scopesSupported.includes('offline_access')) scopes.add('offline_access')
  return scopes.size > 0 ? [...scopes].join(' ') : null
}

export function authorizationUrl(
  server: AuthServer,
  client: ClientRegistration,
  options: { resource: string; scope: string | null; state: string; codeChallenge: string }
): string {
  const url = new URL(server.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', client.clientId)
  url.searchParams.set('redirect_uri', client.redirectUri)
  url.searchParams.set('code_challenge', options.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', options.state)
  url.searchParams.set('resource', options.resource)
  if (options.scope) url.searchParams.set('scope', options.scope)
  return url.toString()
}

/**
 * Contrôle du retour du navigateur, avant d'envoyer le code où que ce soit :
 * `state` identique, puis `iss` selon le tableau de la spécification (RFC 9207 §2.4).
 */
export function validateCallback(params: URLSearchParams, expected: { state: string; issuer: string; issRequired: boolean }): string {
  const iss = params.get('iss')
  if (iss !== null && iss !== expected.issuer) throw new OAuthError("La réponse vient d'un autre serveur d'autorisation : connexion refusée.")
  if (iss === null && expected.issRequired) throw new OAuthError("La réponse du serveur d'autorisation n'est pas signée de son émetteur : connexion refusée.")
  if (params.get('state') !== expected.state) throw new OAuthError('La réponse ne correspond pas à cette demande de connexion : connexion refusée.')
  const error = params.get('error')
  if (error) throw new OAuthError(error === 'access_denied' ? 'Connexion refusée dans le navigateur.' : `Le serveur a refusé la connexion (${error}).`)
  const code = params.get('code')
  if (!code) throw new OAuthError("Le serveur n'a pas renvoyé de code d'autorisation.")
  return code
}

async function tokenRequest(fetchImpl: Fetch, tokenEndpoint: string, form: Record<string, string>, secret: string | null, clientId: string): Promise<TokenSet> {
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
  if (secret) headers['Authorization'] = `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(secret)}`).toString('base64')}`
  const response = await request(fetchImpl, tokenEndpoint, { method: 'POST', headers, body: new URLSearchParams(form).toString() })
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok || typeof body['access_token'] !== 'string') {
    const error = typeof body['error'] === 'string' ? body['error'] : `HTTP ${response.status}`
    throw new OAuthError(error === 'invalid_grant' ? 'invalid_grant' : `Le serveur n'a pas délivré de jeton (${error}).`)
  }
  if (typeof body['token_type'] === 'string' && body['token_type'].toLowerCase() !== 'bearer') {
    throw new OAuthError('Type de jeton inattendu : seul Bearer est pris en charge.')
  }
  const expiresIn = Number(body['expires_in'])
  return {
    accessToken: body['access_token'],
    refreshToken: typeof body['refresh_token'] === 'string' ? body['refresh_token'] : null,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : null,
    scope: typeof body['scope'] === 'string' ? body['scope'] : null
  }
}

export function exchangeCode(
  fetchImpl: Fetch,
  server: AuthServer,
  client: ClientRegistration,
  options: { code: string; verifier: string; resource: string }
): Promise<TokenSet> {
  return tokenRequest(
    fetchImpl,
    server.tokenEndpoint,
    {
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: client.redirectUri,
      code_verifier: options.verifier,
      resource: options.resource,
      ...(client.clientSecret ? {} : { client_id: client.clientId })
    },
    client.clientSecret,
    client.clientId
  )
}

export const needsRefresh = (grant: TokenSet, now = Date.now()): boolean => grant.expiresAt !== null && grant.expiresAt - EXPIRY_MARGIN_MS <= now

/** Nouveau jeton à partir du jeton de rafraîchissement ; garde l'ancien si le serveur n'en fait pas tourner un nouveau. */
export async function refreshGrant(fetchImpl: Fetch, grant: OAuthGrant): Promise<OAuthGrant> {
  if (!grant.refreshToken) throw new OAuthError('invalid_grant')
  const fresh = await tokenRequest(
    fetchImpl,
    grant.tokenEndpoint,
    {
      grant_type: 'refresh_token',
      refresh_token: grant.refreshToken,
      resource: grant.resource,
      ...(grant.clientSecret ? {} : { client_id: grant.clientId })
    },
    grant.clientSecret,
    grant.clientId
  )
  return { ...grant, ...fresh, refreshToken: fresh.refreshToken ?? grant.refreshToken, scope: fresh.scope ?? grant.scope }
}

/**
 * Révoque le jeton de rafraîchissement puis le jeton d'accès (RFC 7009). Sans adresse de
 * révocation, rien n'est envoyé. Renvoie vrai si le serveur a confirmé chaque révocation.
 */
export async function revokeGrant(fetchImpl: Fetch, revocationEndpoint: string | null, grant: OAuthGrant): Promise<boolean> {
  if (!revocationEndpoint) return false
  const tokens: [string, string][] = [
    ...(grant.refreshToken ? [[grant.refreshToken, 'refresh_token'] as [string, string]] : []),
    [grant.accessToken, 'access_token']
  ]
  let confirmed = true
  for (const [token, hint] of tokens) {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
    const form: Record<string, string> = { token, token_type_hint: hint }
    if (grant.clientSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${encodeURIComponent(grant.clientId)}:${encodeURIComponent(grant.clientSecret)}`).toString('base64')}`
    } else {
      form['client_id'] = grant.clientId
    }
    try {
      const response = await request(fetchImpl, revocationEndpoint, { method: 'POST', headers, body: new URLSearchParams(form).toString() })
      void response.body?.cancel()
      // RFC 7009 §2.2 : 200 même pour un jeton déjà invalide.
      if (!response.ok) confirmed = false
    } catch {
      confirmed = false
    }
  }
  return confirmed
}
