import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  authorizationUrl,
  authServerMetadataUrls,
  canonicalResource,
  chooseScope,
  CIMD_CLIENT_ID,
  CIMD_PORTS,
  cimdClient,
  createPkce,
  discoverAuthServer,
  discoverProtectedResource,
  exchangeCode,
  needsRefresh,
  OAuthError,
  parseBearerChallenge,
  probeServer,
  refreshGrant,
  registerClient,
  revokeGrant,
  validateCallback,
  type AuthServer,
  type Fetch,
  type OAuthGrant
} from './mcpOAuth'

interface Call {
  url: string
  init: RequestInit
}

/** Faux réseau : une réponse par adresse ; tout le reste répond 404. */
function fakeFetch(routes: Record<string, () => Response>): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = []
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, init })
    return routes[url]?.() ?? new Response('', { status: 404 })
  }) as Fetch
  return { fetch: fetchImpl, calls }
}

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Ce que publie réellement mcp.deepl.com (relevé le 2026-11-26).
const DEEPL_AS = {
  issuer: 'https://mcp.deepl.com/',
  authorization_endpoint: 'https://mcp.deepl.com/.idp/auth',
  token_endpoint: 'https://mcp.deepl.com/.idp/token',
  registration_endpoint: 'https://mcp.deepl.com/.idp/register',
  revocation_endpoint: 'https://mcp.deepl.com/.idp/revoke',
  code_challenge_methods_supported: ['S256'],
  scopes_supported: ['offline_access'],
  client_id_metadata_document_supported: true
}

const SERVER: AuthServer = {
  issuer: 'https://mcp.deepl.com/',
  authorizationEndpoint: 'https://mcp.deepl.com/.idp/auth',
  tokenEndpoint: 'https://mcp.deepl.com/.idp/token',
  registrationEndpoint: 'https://mcp.deepl.com/.idp/register',
  revocationEndpoint: 'https://mcp.deepl.com/.idp/revoke',
  scopesSupported: ['offline_access'],
  issParameterSupported: false,
  cimdSupported: true
}

describe('défi WWW-Authenticate', () => {
  it('lit resource_metadata et scope', () => {
    expect(parseBearerChallenge('Bearer resource_metadata="https://mcp.deepl.com/.well-known/oauth-protected-resource"')).toEqual({
      resourceMetadata: 'https://mcp.deepl.com/.well-known/oauth-protected-resource',
      scope: null
    })
    expect(parseBearerChallenge('Bearer realm="x", scope="files:read files:write", resource_metadata="https://a.example/m"')).toEqual({
      resourceMetadata: 'https://a.example/m',
      scope: 'files:read files:write'
    })
  })

  it('trouve le défi Bearer parmi plusieurs, et rien sans lui', () => {
    expect(parseBearerChallenge('Basic realm="x", Bearer scope=read')?.scope).toBe('read')
    expect(parseBearerChallenge('Basic realm="x"')).toBeNull()
    expect(parseBearerChallenge(null)).toBeNull()
  })

  it('distingue un serveur ouvert d’un serveur qui demande une connexion', async () => {
    const open = fakeFetch({ 'https://open.example/mcp': () => json({ jsonrpc: '2.0', id: 1, result: {} }) })
    expect(await probeServer(open.fetch, 'https://open.example/mcp')).toBeNull()
    const locked = fakeFetch({
      'https://mcp.deepl.com/v1/mcp': () => new Response('', { status: 401, headers: { 'WWW-Authenticate': 'Bearer resource_metadata="https://mcp.deepl.com/m"' } })
    })
    expect(await probeServer(locked.fetch, 'https://mcp.deepl.com/v1/mcp')).toEqual({ resourceMetadata: 'https://mcp.deepl.com/m', scope: null })
    expect(locked.calls[0]!.init.headers).not.toHaveProperty('Authorization')
  })
})

describe('découverte', () => {
  it('normalise l’adresse du serveur', () => {
    expect(canonicalResource('HTTPS://MCP.Example.com/mcp/#frag')).toBe('https://mcp.example.com/mcp')
    expect(canonicalResource('https://mcp.example.com/')).toBe('https://mcp.example.com')
  })

  it('suit l’adresse du défi, sinon le chemin de l’endpoint, puis la racine', async () => {
    const prm = { resource: 'https://a.example/v1/mcp', authorization_servers: ['https://auth.example'] }
    const viaHeader = fakeFetch({ 'https://a.example/meta': () => json(prm) })
    expect((await discoverProtectedResource(viaHeader.fetch, 'https://a.example/v1/mcp', { resourceMetadata: 'https://a.example/meta', scope: null })).authorizationServers).toEqual(['https://auth.example'])
    const viaRoot = fakeFetch({ 'https://a.example/.well-known/oauth-protected-resource': () => json(prm) })
    await discoverProtectedResource(viaRoot.fetch, 'https://a.example/v1/mcp', { resourceMetadata: null, scope: null })
    expect(viaRoot.calls.map((call) => call.url)).toEqual([
      'https://a.example/.well-known/oauth-protected-resource/v1/mcp',
      'https://a.example/.well-known/oauth-protected-resource'
    ])
  })

  it('refuse des métadonnées qui décrivent un autre serveur', async () => {
    const other = fakeFetch({ 'https://a.example/meta': () => json({ resource: 'https://evil.example/mcp', authorization_servers: ['https://auth.example'] }) })
    await expect(discoverProtectedResource(other.fetch, 'https://a.example/v1/mcp', { resourceMetadata: 'https://a.example/meta', scope: null })).rejects.toThrow(OAuthError)
  })

  it('essaie les adresses du serveur d’autorisation dans l’ordre de la spécification', () => {
    expect(authServerMetadataUrls('https://auth.example')).toEqual([
      'https://auth.example/.well-known/oauth-authorization-server',
      'https://auth.example/.well-known/openid-configuration'
    ])
    expect(authServerMetadataUrls('https://auth.example/tenant1')).toEqual([
      'https://auth.example/.well-known/oauth-authorization-server/tenant1',
      'https://auth.example/.well-known/openid-configuration/tenant1',
      'https://auth.example/tenant1/.well-known/openid-configuration'
    ])
  })

  it('accepte la configuration de DeepL', async () => {
    const deepl = fakeFetch({ 'https://mcp.deepl.com/.well-known/oauth-authorization-server': () => json(DEEPL_AS) })
    expect(await discoverAuthServer(deepl.fetch, 'https://mcp.deepl.com/')).toEqual(SERVER)
  })

  it('refuse un émetteur différent, l’absence de PKCE S256 ou une adresse en http', async () => {
    const url = 'https://mcp.deepl.com/.well-known/oauth-authorization-server'
    for (const metadata of [
      { ...DEEPL_AS, issuer: 'https://honest.example/' },
      { ...DEEPL_AS, code_challenge_methods_supported: undefined },
      { ...DEEPL_AS, code_challenge_methods_supported: ['plain'] },
      { ...DEEPL_AS, token_endpoint: 'http://mcp.deepl.com/.idp/token' }
    ]) {
      await expect(discoverAuthServer(fakeFetch({ [url]: () => json(metadata) }).fetch, 'https://mcp.deepl.com/')).rejects.toThrow(OAuthError)
    }
  })
})

describe('enregistrement et autorisation', () => {
  it('s’enregistre en application native, sans secret, avec rafraîchissement', async () => {
    const server = fakeFetch({ 'https://mcp.deepl.com/.idp/register': () => json({ client_id: 'abc' }, 201) })
    const client = await registerClient(server.fetch, SERVER, 'http://127.0.0.1:53682/callback')
    expect(client).toEqual({ issuer: 'https://mcp.deepl.com/', clientId: 'abc', clientSecret: null, redirectUri: 'http://127.0.0.1:53682/callback' })
    expect(JSON.parse(String(server.calls[0]!.init.body))).toMatchObject({
      application_type: 'native',
      redirect_uris: ['http://127.0.0.1:53682/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none'
    })
  })

  it("s'identifie par le document de la landing, sans rien enregistrer, avec un port déclaré", async () => {
    expect(cimdClient(SERVER, CIMD_PORTS[0])).toEqual({
      issuer: 'https://mcp.deepl.com/',
      clientId: 'https://agenttoolbox.netlify.app/oauth/client.json',
      clientSecret: null,
      redirectUri: `http://127.0.0.1:${CIMD_PORTS[0]}/callback`
    })
    const { readFileSync, existsSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    // Le document publié (dépôt voisin de la landing) doit annoncer exactement ces ports,
    // sinon le serveur refuserait le retour. Sans ce dépôt à côté, la vérification est sautée.
    const published = resolve(__dirname, '../../../../agent-toolbox-landing/public/oauth/client.json')
    if (existsSync(published)) {
      const document = JSON.parse(readFileSync(published, 'utf8'))
      expect(document.client_id).toBe(CIMD_CLIENT_ID)
      expect(document.redirect_uris).toEqual(CIMD_PORTS.map((port) => `http://127.0.0.1:${port}/callback`))
    }
  })

  it('PKCE en S256 : le défi est le SHA-256 du vérificateur', () => {
    const { verifier, challenge } = createPkce()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  it('choisit la portée du défi, et ajoute offline_access quand il est proposé', () => {
    const resource = { resource: 'r', authorizationServers: [], scopesSupported: ['a'] }
    expect(chooseScope({ resourceMetadata: null, scope: 'files:read' }, resource, SERVER)).toBe('files:read offline_access')
    expect(chooseScope({ resourceMetadata: null, scope: null }, resource, { ...SERVER, scopesSupported: [] })).toBe('a')
    expect(chooseScope({ resourceMetadata: null, scope: null }, { ...resource, scopesSupported: [] }, { ...SERVER, scopesSupported: [] })).toBeNull()
  })

  it('demande l’autorisation avec PKCE, state et resource', () => {
    const url = new URL(
      authorizationUrl(SERVER, { issuer: SERVER.issuer, clientId: 'abc', clientSecret: null, redirectUri: 'http://127.0.0.1:1/callback' }, {
        resource: 'https://mcp.deepl.com/v1/mcp',
        scope: 'offline_access',
        state: 's',
        codeChallenge: 'c'
      })
    )
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'abc',
      redirect_uri: 'http://127.0.0.1:1/callback',
      code_challenge: 'c',
      code_challenge_method: 'S256',
      state: 's',
      resource: 'https://mcp.deepl.com/v1/mcp',
      scope: 'offline_access'
    })
  })
})

describe('retour du navigateur (RFC 9207)', () => {
  const expected = { state: 's', issuer: 'https://mcp.deepl.com/', issRequired: false }
  const params = (values: Record<string, string>): URLSearchParams => new URLSearchParams(values)

  it('accepte un retour conforme, avec ou sans iss quand il n’est pas exigé', () => {
    expect(validateCallback(params({ code: 'k', state: 's' }), expected)).toBe('k')
    expect(validateCallback(params({ code: 'k', state: 's', iss: 'https://mcp.deepl.com/' }), expected)).toBe('k')
  })

  it('refuse un autre émetteur, même sans le normaliser, et iss absent quand il est annoncé', () => {
    expect(() => validateCallback(params({ code: 'k', state: 's', iss: 'https://evil.example/' }), expected)).toThrow(OAuthError)
    expect(() => validateCallback(params({ code: 'k', state: 's', iss: 'https://mcp.deepl.com' }), expected)).toThrow(OAuthError)
    expect(() => validateCallback(params({ code: 'k', state: 's' }), { ...expected, issRequired: true })).toThrow(OAuthError)
  })

  it('refuse un state différent, et n’affiche pas l’erreur d’un émetteur inconnu', () => {
    expect(() => validateCallback(params({ code: 'k', state: 'autre' }), expected)).toThrow(/cette demande/)
    expect(() => validateCallback(params({ error: 'access_denied', state: 's', iss: 'https://evil.example/' }), expected)).toThrow(/autre serveur/)
    expect(() => validateCallback(params({ error: 'access_denied', state: 's' }), expected)).toThrow(/refusée dans le navigateur/)
  })
})

describe('jetons', () => {
  const client = { issuer: SERVER.issuer, clientId: 'abc', clientSecret: null, redirectUri: 'http://127.0.0.1:1/callback' }

  it('échange le code avec le vérificateur PKCE et la ressource', async () => {
    const server = fakeFetch({ 'https://mcp.deepl.com/.idp/token': () => json({ access_token: 'A', token_type: 'Bearer', expires_in: 3600, refresh_token: 'R' }) })
    const tokens = await exchangeCode(server.fetch, SERVER, client, { code: 'k', verifier: 'v', resource: 'https://mcp.deepl.com/v1/mcp' })
    expect(tokens).toMatchObject({ accessToken: 'A', refreshToken: 'R' })
    expect(tokens.expiresAt).toBeGreaterThan(Date.now())
    expect(Object.fromEntries(new URLSearchParams(String(server.calls[0]!.init.body)))).toEqual({
      grant_type: 'authorization_code',
      code: 'k',
      redirect_uri: 'http://127.0.0.1:1/callback',
      code_verifier: 'v',
      resource: 'https://mcp.deepl.com/v1/mcp',
      client_id: 'abc'
    })
  })

  const grant: OAuthGrant = {
    issuer: SERVER.issuer,
    tokenEndpoint: SERVER.tokenEndpoint,
    resource: 'https://mcp.deepl.com/v1/mcp',
    clientId: 'abc',
    clientSecret: null,
    accessToken: 'A',
    refreshToken: 'R',
    expiresAt: Date.now() + 30_000,
    scope: null
  }

  it('rafraîchit un jeton qui expire bientôt, et seulement celui-là', () => {
    expect(needsRefresh(grant)).toBe(true)
    expect(needsRefresh({ ...grant, expiresAt: Date.now() + 3_600_000 })).toBe(false)
    expect(needsRefresh({ ...grant, expiresAt: null })).toBe(false)
  })

  it('prend le nouveau jeton de rafraîchissement, ou garde l’ancien', async () => {
    const rotated = fakeFetch({ 'https://mcp.deepl.com/.idp/token': () => json({ access_token: 'B', token_type: 'bearer', refresh_token: 'R2', expires_in: 60 }) })
    expect(await refreshGrant(rotated.fetch, grant)).toMatchObject({ accessToken: 'B', refreshToken: 'R2' })
    expect(new URLSearchParams(String(rotated.calls[0]!.init.body)).get('resource')).toBe('https://mcp.deepl.com/v1/mcp')
    const kept = fakeFetch({ 'https://mcp.deepl.com/.idp/token': () => json({ access_token: 'C', token_type: 'Bearer' }) })
    expect(await refreshGrant(kept.fetch, grant)).toMatchObject({ accessToken: 'C', refreshToken: 'R' })
  })

  it('révoque le jeton de rafraîchissement puis le jeton d’accès, avec l’identifiant de l’app', async () => {
    const server = fakeFetch({ 'https://mcp.deepl.com/.idp/revoke': () => new Response('', { status: 200 }) })
    expect(await revokeGrant(server.fetch, 'https://mcp.deepl.com/.idp/revoke', grant)).toBe(true)
    expect(server.calls.map((call) => Object.fromEntries(new URLSearchParams(String(call.init.body))))).toEqual([
      { token: 'R', token_type_hint: 'refresh_token', client_id: 'abc' },
      { token: 'A', token_type_hint: 'access_token', client_id: 'abc' }
    ])
    expect(await revokeGrant(server.fetch, null, grant)).toBe(false)
  })

  it('signale un rafraîchissement refusé, pour demander une reconnexion', async () => {
    const refused = fakeFetch({ 'https://mcp.deepl.com/.idp/token': () => json({ error: 'invalid_grant' }, 400) })
    await expect(refreshGrant(refused.fetch, grant)).rejects.toThrow('invalid_grant')
    await expect(refreshGrant(refused.fetch, { ...grant, refreshToken: null })).rejects.toThrow('invalid_grant')
  })
})
