import { app } from 'electron'
import { registerAgentIpc } from './agentIpc'
import { createTray } from './tray'
import { createWindows, openPanel } from './windows'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openPanel())
  // L'app reste active sans fenêtre visible : elle vit dans l'icône flottante.
  app.on('window-all-closed', () => undefined)
  void app.whenReady().then(() => {
    app.dock?.hide()
    registerAgentIpc()
    createWindows()
    createTray()
  })
}
