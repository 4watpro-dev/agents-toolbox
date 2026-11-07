import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { Result } from '../shared/ipc'
import { buildLoginItemPlist, LOGIN_ITEM_LABEL } from './loginItemPlist'

const plistPath = (): string => join(app.getPath('home'), 'Library/LaunchAgents', `${LOGIN_ITEM_LABEL}.plist`)

/**
 * Deux modes :
 * - app installée (`npm run app`) : l'option de macOS « Ouvrir à la connexion » ;
 * - mode développement : un fichier LaunchAgent qui lance le projet buildé, car
 *   l'option de macOS lancerait Electron sans le projet.
 */
export function isLoginItemEnabled(): boolean {
  if (app.isPackaged) return app.getLoginItemSettings().openAtLogin
  return existsSync(plistPath())
}

export function setLoginItemEnabled(enabled: boolean): Result {
  if (app.isPackaged) {
    // L'ancien LaunchAgent lancerait aussi le projet : on le retire dans tous les cas.
    rmSync(plistPath(), { force: true })
    app.setLoginItemSettings({ openAtLogin: enabled })
    return { ok: true, value: undefined }
  }
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

/**
 * Au premier lancement de l'app installée, un LaunchAgent du mode développement
 * devient l'option de macOS : le réglage est gardé, et une seule app se lance.
 */
export function migrateLoginItem(): void {
  if (!app.isPackaged || !existsSync(plistPath())) return
  setLoginItemEnabled(true)
}
