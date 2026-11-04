import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { z } from 'zod'
import { ConnectorSchema, type Connector, type ConnectorInput, type StoredConnector } from '../../shared/connectors'
import type { Result } from '../../shared/ipc'
import type { ResolvedConnector } from '../ai/toolGuard'
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
  return readStored().map((connector) => ({ ...connector, hasToken: connector.id in tokens }))
}

export function saveConnector(id: string | null, input: ConnectorInput): Result<Connector> {
  const stored = readStored()
  if (id && !stored.some((connector) => connector.id === id)) return { ok: false, message: 'Ce connecteur a été supprimé.' }
  const tokens = readTokens()
  if (input.token && !safeStorage.isEncryptionAvailable()) {
    return { ok: false, message: "Le trousseau macOS est indisponible : le jeton ne peut pas être chiffré, rien n'a été enregistré." }
  }

  const connector: StoredConnector = { id: id ?? randomUUID(), name: input.name, url: input.url }
  if (input.token !== null) {
    if (input.token) tokens[connector.id] = input.token
    else delete tokens[connector.id]
    writeTokens(tokens)
  }
  writeJson(connectorsPath(), id ? stored.map((other) => (other.id === id ? connector : other)) : [...stored, connector])
  return { ok: true, value: { ...connector, hasToken: connector.id in tokens } }
}

export function removeConnector(id: string): void {
  writeJson(connectorsPath(), readStored().filter((connector) => connector.id !== id))
  const tokens = readTokens()
  if (id in tokens) {
    delete tokens[id]
    writeTokens(tokens)
  }
}

/** Connecteurs réellement disponibles pour un agent : un connecteur supprimé disparaît de lui-même. */
export function resolveConnectors(ids: string[]): ResolvedConnector[] {
  const tokens = readTokens()
  return readStored()
    .filter((connector) => ids.includes(connector.id))
    .map(({ id, name, url }) => ({ name, url, token: tokens[id] ?? null }))
}
