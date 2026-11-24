import { useEffect, useState } from 'react'

/** Heure courante, rafraîchie chaque seconde seulement tant qu'un travail est en cours. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/** « 45 s » ou « 2 min 05 », pour le temps passé à attendre. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')}`
}

interface WorkingLineProps {
  text: string
  /** Début de l'attente (Date.now) : affiche le temps écoulé. */
  since?: number
  /** Fine barre lumineuse sous le texte. */
  bar?: boolean
}

/**
 * Ligne d'attente animée : trois points et une barre qui défile. Que des
 * transformations et de l'opacité, que la carte graphique anime sans redessiner.
 */
export function WorkingLine({ text, since, bar = true }: WorkingLineProps): React.JSX.Element {
  const now = useNow(since !== undefined)
  return (
    <div className="working" role="status">
      <p className="chat-waiting working-line">
        <span>{text.replace(/…$/, '')}</span>
        <span className="working-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {since !== undefined && <span className="working-time">{formatElapsed(now - since)}</span>}
      </p>
      {bar && (
        <span className="working-bar" aria-hidden="true">
          <i />
        </span>
      )}
    </div>
  )
}
