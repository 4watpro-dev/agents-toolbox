import { useEffect } from 'react'

/**
 * Tant que `active` est vrai, Échap appelle `onEscape` au lieu de fermer le panneau,
 * où que soit le focus. Le panneau ignore les événements marqués `defaultPrevented`.
 */
export function useEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscape()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, onEscape])
}
