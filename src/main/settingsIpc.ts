import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '../shared/ipc'
import { isLoginItemEnabled, setLoginItemEnabled } from './loginItem'
import { changeShortcut, isShortcutActive, startShortcut, suspendShortcut } from './shortcut'
import { getSettings } from './store/settings'
import { refreshTrayMenu } from './tray'

const AcceleratorSchema = z.string().regex(/^[\w+\-=,./;'`[\]\\]{1,60}$/)

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.shortcutGet, () => ({ accelerator: getSettings().shortcut, active: isShortcutActive() }))
  ipcMain.handle(IPC.shortcutSet, (_event, accelerator: unknown) => changeShortcut(AcceleratorSchema.parse(accelerator)))
  ipcMain.on(IPC.shortcutSuspend, () => suspendShortcut())
  ipcMain.on(IPC.shortcutResume, () => startShortcut())

  ipcMain.handle(IPC.loginItemGet, () => isLoginItemEnabled())
  ipcMain.handle(IPC.loginItemSet, (_event, enabled: unknown) => {
    const result = setLoginItemEnabled(z.boolean().parse(enabled))
    refreshTrayMenu()
    return result
  })
}
