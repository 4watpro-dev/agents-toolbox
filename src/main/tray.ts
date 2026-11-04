import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'
import { openDemo, openPanel } from './windows'

// Gardé au niveau du module : sinon le ramasse-miettes fait disparaître l'icône.
let tray: Tray | null = null

export function createTray(): void {
  // « Template » : macOS adapte la couleur au thème clair ou sombre de la barre.
  const icon = nativeImage.createFromPath(join(app.getAppPath(), 'resources/trayTemplate.png'))
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Agent Toolbox')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir', click: () => openPanel() },
      { label: "Démo de l'avatar", click: () => openDemo() },
      { type: 'separator' },
      { label: 'Quitter', click: () => app.quit() }
    ])
  )
}
