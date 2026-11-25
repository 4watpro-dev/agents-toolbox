import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { TOOL_GUARD_FLAG, TOOL_GUARD_SCRIPT } from './ai/toolGuard'

/** Vrai quand Claude Code a relancé l'app pour contrôler un appel d'outil. */
export function isToolGuardRun(argv: string[] = process.argv): boolean {
  return argv.includes(TOOL_GUARD_FLAG)
}

/**
 * Contrôle d'un appel d'outil, dans un processus de l'app lancé par Claude Code.
 * Ni fenêtre, ni Dock, ni Cmd+Tab ; ses données vivent dans un dossier temporaire,
 * pour ne jamais toucher à celles de l'app ouverte. Le script lit l'appel sur
 * l'entrée standard, écrit la décision et arrête le processus.
 */
export function runToolGuard(): void {
  try {
    app.setActivationPolicy('prohibited')
  } catch {
    // Sans effet hors macOS.
  }
  app.dock?.hide()
  app.disableHardwareAcceleration()
  const scratch = mkdtempSync(join(tmpdir(), 'agent-toolbox-guard-'))
  app.setPath('userData', scratch)
  app.setPath('sessionData', scratch)
  // Sous Electron, process.exit saute les gestionnaires « exit » : on nettoie juste avant.
  const exit = process.exit.bind(process)
  process.exit = ((code?: number) => {
    rmSync(scratch, { recursive: true, force: true })
    return exit(code)
  }) as typeof process.exit
  app.on('window-all-closed', () => undefined)
  app.on('will-quit', () => undefined)
  // Le script est celui que les tests exécutent sous Node : même code, même décisions.
  new Function('require', TOOL_GUARD_SCRIPT)(require)
}
