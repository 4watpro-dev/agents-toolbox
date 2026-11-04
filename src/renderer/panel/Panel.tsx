import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Corner, PanelState } from '../../shared/ipc'

const TRANSFORM_ORIGIN: Record<Corner, string> = {
  'top-left': 'top left',
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'bottom-right': 'bottom right'
}

export function Panel(): React.JSX.Element {
  const [state, setState] = useState<PanelState>({ open: false, corner: 'bottom-right', requestedAt: 0 })

  useEffect(() => window.toolbox.panel.onState(setState), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') window.toolbox.panel.close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Deux images d'affilée : la seconde garantit que la première a bien été peinte.
  useEffect(() => {
    if (!state.open) return
    const { requestedAt } = state
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.toolbox.panel.painted(requestedAt))
    })
    return () => cancelAnimationFrame(frame)
  }, [state])

  return (
    <motion.main
      className="panel"
      style={{ transformOrigin: TRANSFORM_ORIGIN[state.corner] }}
      initial={false}
      animate={state.open ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
      transition={{ duration: state.open ? 0.16 : 0.1, ease: 'easeOut' }}
    >
      <h1>Agent Toolbox</h1>
      <p>Tes agents apparaîtront ici.</p>
    </motion.main>
  )
}
