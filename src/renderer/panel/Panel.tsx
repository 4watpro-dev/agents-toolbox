import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Agent } from '../../shared/agent'
import type { Corner, PanelState } from '../../shared/ipc'
import { AvatarPausedContext } from '../avatar/Avatar'
import { AgentDetails } from './AgentDetails'
import { AgentSwitcher } from './AgentSwitcher'
import { ChatView } from './chat/ChatView'
import { Gallery } from './Gallery'
import { SettingsView } from './SettingsView'
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
  | { name: 'agent'; agentId: string; conversationId: string }
  | { name: 'details'; agentId: string; conversationId: string }
  | { name: 'settings'; returnTo: View }

export function Panel(): React.JSX.Element {
  const [state, setState] = useState<PanelState>({ open: false, corner: 'bottom-right', requestedAt: 0 })
  const [view, setView] = useState<View>({ name: 'gallery' })
  const { agents, error, reload, save, remove, setFavorite } = useAgents()
  const openSettings = (): void =>
    setView((current) => (current.name === 'settings' ? current : { name: 'settings', returnTo: current }))

  useEffect(() => window.toolbox.panel.onState(setState), [])
  useEffect(() => window.toolbox.panel.onNavigate(openSettings), [])

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

  /** Rouvre la dernière conversation de l'agent, ou en commence une nouvelle. */
  async function openAgent(agent: Agent): Promise<void> {
    void window.toolbox.agents.markUsed(agent.id)
    const conversations = await window.toolbox.conversations.list(agent.id)
    setView({ name: 'agent', agentId: agent.id, conversationId: conversations[0]?.id ?? crypto.randomUUID() })
  }

  const conversationAgent =
    view.name === 'agent' || view.name === 'details' ? agents.find((agent) => agent.id === view.agentId) : undefined

  return (
    <AvatarPausedContext.Provider value={!state.open}>
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
      {view.name === 'settings' ? (
        <SettingsView panelOpen={state.open} onBack={() => setView(view.returnTo)} onAgentsChanged={reload} />
      ) : view.name === 'wizard' ? (
        <AgentWizard
          agent={view.agent}
          panelOpen={state.open}
          onCancel={() => setView({ name: 'gallery' })}
          onOpenSettings={openSettings}
          onSave={async (draft) => {
            await save(view.agent?.id ?? null, draft)
            setView({ name: 'gallery' })
          }}
        />
      ) : view.name === 'details' && conversationAgent ? (
        <AgentDetails
          agent={conversationAgent}
          currentConversationId={view.conversationId}
          onBack={() => setView({ ...view, name: 'agent' })}
          onOpenConversation={(conversationId) => setView({ name: 'agent', agentId: view.agentId, conversationId })}
          onNewConversation={() =>
            setView({ name: 'agent', agentId: view.agentId, conversationId: crypto.randomUUID() })
          }
        />
      ) : view.name === 'agent' && conversationAgent ? (
        <ChatView
          sessionId={view.conversationId}
          agent={conversationAgent}
          agentId={conversationAgent.id}
          panelOpen={state.open}
          backLabel="Retour à la galerie"
          onBack={() => setView({ name: 'gallery' })}
          onNew={() => setView({ ...view, conversationId: crypto.randomUUID() })}
          onDetails={() => setView({ ...view, name: 'details' })}
          onEdit={() => setView({ name: 'wizard', agent: conversationAgent })}
          onOpenSettings={openSettings}
          switcher={<AgentSwitcher agent={conversationAgent} agents={agents} onSwitch={(agent) => void openAgent(agent)} />}
        />
      ) : (
        <Gallery
          agents={agents}
          panelOpen={state.open}
          onOpen={(agent) => void openAgent(agent)}
          onOpenSettings={openSettings}
          onCreate={() => setView({ name: 'wizard', agent: null })}
          onEdit={(agent) => setView({ name: 'wizard', agent })}
          onRemove={remove}
          onToggleFavorite={(agent) => setFavorite(agent.id, !agent.isFavorite)}
        />
      )}
    </motion.main>
    </AvatarPausedContext.Provider>
  )
}
