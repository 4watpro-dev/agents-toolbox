import { powerMonitor } from 'electron'
import { sendWidgetSignal } from './windows'

/** Sans clavier ni souris depuis ce délai, la personne est considérée absente. */
export const AWAY_AFTER_SECONDS = 5 * 60
/** Vérification peu fréquente : lire le temps d'inactivité ne coûte presque rien. */
const CHECK_INTERVAL_MS = 10_000

let away = false

function setAway(next: boolean): void {
  if (next === away) return
  away = next
  sendWidgetSignal(next ? { type: 'away' } : { type: 'back' })
}

/** Le fantôme s'assoupit quand la personne s'absente, et se réveille à son retour. */
export function startActivityWatch(): void {
  setInterval(() => setAway(powerMonitor.getSystemIdleTime() >= AWAY_AFTER_SECONDS), CHECK_INTERVAL_MS)
  powerMonitor.on('lock-screen', () => setAway(true))
  powerMonitor.on('unlock-screen', () => setAway(false))
  powerMonitor.on('suspend', () => setAway(true))
  powerMonitor.on('resume', () => setAway(powerMonitor.getSystemIdleTime() >= AWAY_AFTER_SECONDS))
}

/** État courant, pour une icône qui vient de (re)charger sa page. */
export function isAway(): boolean {
  return away
}
