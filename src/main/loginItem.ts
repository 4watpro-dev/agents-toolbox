import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { Result } from '../shared/ipc'
import { buildLoginItemPlist, LOGIN_ITEM_LABEL } from './loginItemPlist'

const plistPath = (): string => join(app.getPath('home'), 'Library/LaunchAgents', `${LOGIN_ITEM_LABEL}.plist`)

export function isLoginItemEnabled(): boolean {
  return existsSync(plistPath())
}

/**
 * L'app n'étant pas empaquetée, l'option d'Electron prévue pour cela lancerait
 * Electron sans le projet : un fichier LaunchAgent lance donc le projet buildé.
 */
export function setLoginItemEnabled(enabled: boolean): Result {
  if (!enabled) {
    rmSync(plistPath(), { force: true })
    return { ok: true, value: undefined }
  }
  if (!existsSync(join(app.getAppPath(), 'out/renderer/panel.html'))) {
    return { ok: false, message: 'Lance d\'abord « npm run build » : le démarrage automatique utilise la version buildée.' }
  }
  mkdirSync(dirname(plistPath()), { recursive: true })
  writeFileSync(plistPath(), buildLoginItemPlist(process.execPath, app.getAppPath()))
  return { ok: true, value: undefined }
}
