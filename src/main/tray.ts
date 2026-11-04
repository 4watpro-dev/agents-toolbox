import { join } from 'node:path'
import { app, dialog, Menu, nativeImage, Tray } from 'electron'
import { isLoginItemEnabled, setLoginItemEnabled } from './loginItem'
import { openDemo, openPanel, openSettingsInPanel } from './windows'

// Gardé au niveau du module : sinon le ramasse-miettes fait disparaître l'icône.
let tray: Tray | null = null

function toggleLoginItem(): void {
  const result = setLoginItemEnabled(!isLoginItemEnabled())
  if (!result.ok) dialog.showErrorBox('Lancer au démarrage', result.message)
  refreshTrayMenu()
}

/** À appeler quand le lancement au démarrage change, pour que la coche reste juste. */
export function refreshTrayMenu(): void {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir', click: () => openPanel() },
      { label: 'Réglages', click: () => openSettingsInPanel() },
      { label: 'Lancer au démarrage', type: 'checkbox', checked: isLoginItemEnabled(), click: toggleLoginItem },
      { type: 'separator' },
      { label: "Démo de l'avatar", click: () => openDemo() },
      { type: 'separator' },
      { label: 'Quitter', click: () => app.quit() }
    ])
  )
}

export function createTray(): void {
  // « Template » : macOS adapte la couleur au thème clair ou sombre de la barre.
  const icon = nativeImage.createFromPath(join(app.getAppPath(), 'resources/trayTemplate.png'))
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Agent Toolbox')
  refreshTrayMenu()
}
