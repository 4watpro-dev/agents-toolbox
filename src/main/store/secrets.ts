import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'

const secretsPath = (): string => join(app.getPath('userData'), 'secrets.bin')

/** La clé ne quitte jamais le process main et n'est jamais écrite en clair. */
export function readApiKey(): string | null {
  let encrypted: Buffer
  try {
    encrypted = readFileSync(secretsPath())
  } catch {
    return null
  }
  try {
    return safeStorage.decryptString(encrypted)
  } catch {
    // Trousseau refusé ou réinitialisé : il faudra saisir la clé à nouveau.
    console.warn('[secrets] déchiffrement de la clé impossible')
    return null
  }
}

export function canStoreSecrets(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function writeApiKey(key: string): void {
  const temporary = `${secretsPath()}.${process.pid}.tmp`
  writeFileSync(temporary, safeStorage.encryptString(key), { mode: 0o600 })
  renameSync(temporary, secretsPath())
}

export function deleteApiKey(): void {
  rmSync(secretsPath(), { force: true })
}
