import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { z } from 'zod'
import { ConnectorSchema, type Connector, type ConnectorInput, type StoredConnector } from '../../shared/connectors'
import type { Result } from '../../shared/ipc'
import type { ResolvedConnector } from '../ai/toolGuard'
import { freshAccessToken } from '../oauth/connectorLogin'
import { connectedIds, removeGrant } from './connectorAuth'
import { readJson, writeJson } from './jsonFile'

const ConnectorsSchema = z.array(ConnectorSchema)

const connectorsPath = (): string => join(app.getPath('userData'), 'connectors.json')
const tokensPath = (): string => join(app.getPath('userData'), 'connector-tokens.bin')

function readStored(): StoredConnector[] {
  return readJson(connectorsPath(), ConnectorsSchema, [])
}

/** Les jetons, comme la clé API, ne quittent pas le process principal et ne sont jamais écrits en clair. */
function readTokens(): Record<string, string> {
  let encrypted: Buffer
  try {
    encrypted = readFileSync(tokensPath())
  } catch {
    return {}
  }
  try {
    return z.record(z.string(), z.string()).parse(JSON.parse(safeStorage.decryptString(encrypted)))
  } catch {
    console.warn('[connecteurs] déchiffrement des jetons impossible')
    return {}
  }
}

function writeTokens(tokens: Record<string, string>): void {
  if (Object.keys(tokens).length === 0) {
    rmSync(tokensPath(), { force: true })
    return
  }
  const temporary = `${tokensPath()}.${process.pid}.tmp`
  writeFileSync(temporary, safeStorage.encryptString(JSON.stringify(tokens)), { mode: 0o600 })
  renameSync(temporary, tokensPath())
}

export function listConnectors(): Connector[] {
  const tokens = readTokens()
  const connected = connectedIds()
  return readStored().map((connector) => ({ ...connector, hasToken: connector.id in tokens, connected: connected.has(connector.id) }))
}

export function getConnector(id: string): StoredConnector | null {
  return readStored().find((connector) => connector.id === id) ?? null
}

/**
 * `auth` : mode choisi par l'appelant. Un jeton saisi impose le mode jeton ; sinon,
 * le mode OAuth est retenu quand le serveur a répondu 401 avec sa découverte OAuth.
 */
export function saveConnector(id: string | null, input: ConnectorInput, auth: StoredConnector['auth']): Result<Connector> {
  const stored = readStored()
  const previous = id ? stored.find((connector) => connector.id === id) : undefined
  if (id && !previous) return { ok: false, message: 'Ce connecteur a été supprimé.' }
  const tokens = readTokens()
  if (input.token && !safeStorage.isEncryptionAvailable()) {
    return { ok: false, message: "Le trousseau macOS est indisponible : le jeton ne peut pas être chiffré, rien n'a été enregistré." }
  }

  const connector: StoredConnector = { id: id ?? randomUUID(), name: input.name, url: input.url, auth }
  if (input.token !== null || auth === 'oauth') {
    if (input.token && auth === 'token') tokens[connector.id] = input.token
    else delete tokens[connector.id]
    writeTokens(tokens)
  }
  // Une autorisation vaut pour un serveur précis : nouvelle adresse ou retour au jeton, il faut se reconnecter.
  if (previous && (previous.url !== connector.url || auth === 'token')) removeGrant(connector.id)
  writeJson(connectorsPath(), id ? stored.map((other) => (other.id === id ? connector : other)) : [...stored, connector])
  return { ok: true, value: { ...connector, hasToken: connector.id in tokens, connected: connectedIds().has(connector.id) } }
}

export function removeConnector(id: string): void {
  writeJson(connectorsPath(), readStored().filter((connector) => connector.id !== id))
  const tokens = readTokens()
  if (id in tokens) {
    delete tokens[id]
    writeTokens(tokens)
  }
  removeGrant(id)
}

/**
 * Connecteurs réellement disponibles pour un agent : un connecteur supprimé disparaît de
 * lui-même. Un connecteur OAuth reçoit un jeton frais ; sans autorisation valide, il est
 * mis de côté et signalé dans `needsLogin`.
 */
export async function resolveConnectors(ids: string[]): Promise<{ connectors: ResolvedConnector[]; needsLogin: string[] }> {
  const tokens = readTokens()
  const connectors: ResolvedConnector[] = []
  const needsLogin: string[] = []
  for (const { id, name, url, auth } of readStored().filter((connector) => ids.includes(connector.id))) {
    if (auth === 'token') {
      connectors.push({ name, url, token: tokens[id] ?? null })
      continue
    }
    const fresh = await freshAccessToken(id)
    if (fresh.token) connectors.push({ name, url, token: fresh.token })
    else needsLogin.push(name)
  }
  return { connectors, needsLogin }
}
