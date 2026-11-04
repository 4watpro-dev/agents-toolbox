import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Agent } from '../../shared/agent'
import type { Corner, PanelState } from '../../shared/ipc'
import { AgentHome } from './AgentHome'
import { Gallery } from './Gallery'
import { useAgents } from './useAgents'
import { AgentWizard } from './wizard/AgentWizard'

const TRANSFORM_ORIGIN: Record<Corner, string> = {
  'top-left': 'top left',
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'bottom-right': 'bottom right'
}

type View =
  | { name: 'gallery' }
  | { name: 'wizard'; agent: Agent | null }
  | { name: 'agent'; agentId: string }

export function Panel(): React.JSX.Element {
  const [state, setState] = useState<PanelState>({ open: false, corner: 'bottom-right', requestedAt: 0 })
  const [view, setView] = useState<View>({ name: 'gallery' })
  const { agents, error, save, remove, setFavorite } = useAgents()

  useEffect(() => window.toolbox.panel.onState(setState), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // Un menu ou une confirmation ouverts consomment Échap en premier.
      if (event.key === 'Escape' && !event.defaultPrevented) window.toolbox.panel.close()
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

  function openAgent(agent: Agent): void {
    void window.toolbox.agents.markUsed(agent.id)
    setView({ name: 'agent', agentId: agent.id })
  }

  const current = view.name === 'agent' ? agents.find((agent) => agent.id === view.agentId) : undefined

  return (
    <motion.main
      // Panneau caché : ses animations CSS s'arrêtent pour ne pas consommer de CPU.
      className={state.open ? 'panel' : 'panel panel-closed'}
      style={{ transformOrigin: TRANSFORM_ORIGIN[state.corner] }}
      initial={false}
      animate={state.open ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
      transition={{ duration: state.open ? 0.16 : 0.1, ease: 'easeOut' }}
    >
      {error && (
        <p className="banner-error" role="alert">
          {error}
        </p>
      )}
      {view.name === 'wizard' ? (
        <AgentWizard
          agent={view.agent}
          onCancel={() => setView({ name: 'gallery' })}
          onSave={async (draft) => {
            await save(view.agent?.id ?? null, draft)
            setView({ name: 'gallery' })
          }}
        />
      ) : current ? (
        <AgentHome
          agent={current}
          onBack={() => setView({ name: 'gallery' })}
          onEdit={() => setView({ name: 'wizard', agent: current })}
        />
      ) : (
        <Gallery
          agents={agents}
          panelOpen={state.open}
          onOpen={openAgent}
          onCreate={() => setView({ name: 'wizard', agent: null })}
          onEdit={(agent) => setView({ name: 'wizard', agent })}
          onRemove={remove}
          onToggleFavorite={(agent) => setFavorite(agent.id, !agent.isFavorite)}
        />
      )}
    </motion.main>
  )
}
