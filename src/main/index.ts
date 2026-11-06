import { app, globalShortcut, nativeTheme } from 'electron'
import { registerAgentIpc } from './agentIpc'
import { stopAllClaudeCode } from './ai/claudeCode'
import { closeToolBridge } from './ai/toolBridge'
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
    closeToolBridge()
    globalShortcut.unregisterAll()
  })
  void app.whenReady().then(() => {
    app.dock?.hide()
    // L'interface est toujours sombre : le verre natif doit l'être aussi, même si le Mac est en clair.
    nativeTheme.themeSource = 'dark'
    registerAgentIpc()
    registerAiIpc()
    registerSettingsIpc()
    registerTransferIpc()
    createWindows()
    createTray()
    startShortcut()
  })
}
