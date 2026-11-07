import { app, globalShortcut, nativeTheme } from 'electron'
import { registerAgentIpc } from './agentIpc'
import { stopAllClaudeCode } from './ai/claudeCode'
import { closeToolBridge } from './ai/toolBridge'
import { registerAiIpc } from './aiIpc'
import { registerSettingsIpc } from './settingsIpc'
import { registerTransferIpc } from './transferIpc'
import { startShortcut } from './shortcut'
import { createTray } from './tray'
import { migrateLoginItem } from './loginItem'
import { createWindows, openPanel, openPanelOnActivate } from './windows'

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
    // L'app reste dans le Dock et dans Cmd+Tab : y revenir ouvre le panneau.
    app.on('activate', () => openPanelOnActivate())
    app.on('did-become-active', () => openPanelOnActivate())
    migrateLoginItem()
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
