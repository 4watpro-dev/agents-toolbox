import { app, globalShortcut } from 'electron'
import { registerAgentIpc } from './agentIpc'
import { stopAllClaudeCode } from './ai/claudeCode'
import { registerAiIpc } from './aiIpc'
import { registerSettingsIpc } from './settingsIpc'
import { registerTransferIpc } from './transferIpc'
import { startShortcut } from './shortcut'
import { createTray } from './tray'
import { createWindows, openPanel } from './windows'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => openPanel())
  // L'app reste active sans fenêtre visible : elle vit dans l'icône flottante.
  app.on('window-all-closed', () => undefined)
  app.on('will-quit', () => {
    stopAllClaudeCode()
    globalShortcut.unregisterAll()
  })
  void app.whenReady().then(() => {
    app.dock?.hide()
    registerAgentIpc()
    registerAiIpc()
    registerSettingsIpc()
    registerTransferIpc()
    createWindows()
    createTray()
    startShortcut()
  })
}
