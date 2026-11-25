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
import { createPalette } from './palette'
import { registerTaskIpc } from './taskIpc'
import { registerTeamIpc } from './teamIpc'
import { startActivityWatch } from './activity'
import { registerExportIpc } from './exportDocs'
import { createWindows, openPanel, openPanelOnActivate } from './windows'
import { isToolGuardRun, runToolGuard } from './toolGuardProcess'

/**
 * Options qui ouvrent l'app à un débogueur : un programme pourrait alors y exécuter
 * son code et lire les secrets du trousseau. Refusées avant tout le reste, contrôle compris.
 */
const DEBUG_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk', 'inspect-port']

if (app.isPackaged && !__ALLOW_DEBUG__ && DEBUG_SWITCHES.some((name) => app.commandLine.hasSwitch(name))) {
  app.exit(1)
} else if (isToolGuardRun()) {
  // Claude Code relance l'app pour contrôler un appel d'outil : rien d'autre ne démarre.
  runToolGuard()
} else if (!app.requestSingleInstanceLock()) {
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
    createPalette()
    createTray()
    registerTaskIpc()
    registerTeamIpc()
    startActivityWatch()
    registerExportIpc()
    startShortcut()
  })
}
