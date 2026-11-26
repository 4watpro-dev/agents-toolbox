import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { z } from 'zod'
import type { ClientRegistration, OAuthGrant } from '../oauth/mcpOAuth'

/**
 * Autorisations OAuth des connecteurs : jetons d'accès et de rafraîchissement, et
 * identifiants d'app obtenus par enregistrement dynamique (un par serveur d'autorisation).
 * Tout est chiffré par safeStorage, dont la clé vit dans le trousseau macOS ; rien
 * n'est écrit en clair et rien ne quitte le process principal.
 */

const GrantSchema = z.object({
  issuer: z.string(),
  tokenEndpoint: z.string(),
  resource: z.string(),
  clientId: z.string(),
  clientSecret: z.string().nullable(),
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresAt: z.number().nullable(),
  scope: z.string().nullable()
})

const ClientSchema = z.object({
  issuer: z.string(),
  clientId: z.string(),
  clientSecret: z.string().nullable(),
  redirectUri: z.string()
})

const VaultSchema = z.object({
  grants: z.record(z.string(), GrantSchema).default({}),
  clients: z.record(z.string(), ClientSchema).default({})
})

type Vault = z.infer<typeof VaultSchema>

const vaultPath = (): string => join(app.getPath('userData'), 'connector-oauth.bin')

function readVault(): Vault {
  let encrypted: Buffer
  try {
    encrypted = readFileSync(vaultPath())
  } catch {
    return { grants: {}, clients: {} }
  }
  try {
    return VaultSchema.parse(JSON.parse(safeStorage.decryptString(encrypted)))
  } catch {
    console.warn('[connecteurs] déchiffrement des autorisations OAuth impossible')
    return { grants: {}, clients: {} }
  }
}

function writeVault(vault: Vault): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('trousseau indisponible')
  if (Object.keys(vault.grants).length === 0 && Object.keys(vault.clients).length === 0) {
    rmSync(vaultPath(), { force: true })
    return
  }
  const temporary = `${vaultPath()}.${process.pid}.tmp`
  writeFileSync(temporary, safeStorage.encryptString(JSON.stringify(vault)), { mode: 0o600 })
  renameSync(temporary, vaultPath())
}

export function getGrant(connectorId: string): OAuthGrant | null {
  return readVault().grants[connectorId] ?? null
}

export function connectedIds(): Set<string> {
  return new Set(Object.keys(readVault().grants))
}

export function saveGrant(connectorId: string, grant: OAuthGrant): void {
  const vault = readVault()
  vault.grants[connectorId] = grant
  writeVault(vault)
}

export function removeGrant(connectorId: string): void {
  const vault = readVault()
  if (!(connectorId in vault.grants)) return
  delete vault.grants[connectorId]
  writeVault(vault)
}

/** Identifiant d'app pour un serveur d'autorisation, lié à son émetteur (spécification MCP, « Authorization Server Binding »). */
export function getClient(issuer: string): ClientRegistration | null {
  return readVault().clients[issuer] ?? null
}

export function saveClient(client: ClientRegistration): void {
  const vault = readVault()
  vault.clients[client.issuer] = client
  writeVault(vault)
}
