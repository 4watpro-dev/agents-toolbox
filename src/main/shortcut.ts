import { globalShortcut } from 'electron'
import { formatAccelerator } from '../shared/shortcut'
import type { Result } from '../shared/ipc'
import { getSettings, updateSettings } from './store/settings'
import { togglePanel } from './windows'

function register(accelerator: string): boolean {
  globalShortcut.unregisterAll()
  try {
    return globalShortcut.register(accelerator, () => togglePanel())
  } catch {
    return false
  }
}

/** Active le raccourci enregistré. `false` s'il est déjà pris par une autre app. */
export function startShortcut(): boolean {
  const registered = register(getSettings().shortcut)
  if (!registered) console.warn(`[raccourci] indisponible : ${getSettings().shortcut}`)
  return registered
}

export function isShortcutActive(): boolean {
  return globalShortcut.isRegistered(getSettings().shortcut)
}

/** Pendant la saisie d'un nouveau raccourci, l'ancien ne doit pas fermer le panneau. */
export function suspendShortcut(): void {
  globalShortcut.unregisterAll()
}

export function changeShortcut(accelerator: string): Result {
  if (register(accelerator)) {
    updateSettings({ shortcut: accelerator })
    return { ok: true, value: undefined }
  }
  startShortcut()
  return {
    ok: false,
    message: `${formatAccelerator(accelerator)} est déjà pris par une autre app ou par macOS. Choisis-en un autre.`
  }
}
