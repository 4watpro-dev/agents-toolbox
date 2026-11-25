import type { PanelState } from '../../shared/ipc'
import { useEffect, useState } from 'react'
import type { Agent } from '../../shared/agent'
import { AvatarPausedContext } from '../avatar/Avatar'
import { AgentDetails } from './AgentDetails'
import { AgentSwitcher } from './AgentSwitcher'
import { ChatView } from './chat/ChatView'
import { Gallery } from './Gallery'
import { SettingsView } from './SettingsView'
import { useAgents } from './useAgents'
import { AgentWizard } from './wizard/AgentWizard'
import type { Team } from '../../shared/teams'
import { TeamChat } from './team/TeamChat'
import { TeamDetails } from './team/TeamDetails'
import { TeamEditor } from './team/TeamEditor'
import { TeamsList } from './team/TeamsList'
import { useTeams } from './team/useTeams'
import { workingConversation } from './team/teamStore'

type View =
  | { name: 'gallery' }
  | { name: 'wizard'; agent: Agent | null }
  | { name: 'agent'; agentId: string; conversationId: string }
  | { name: 'details'; agentId: string; conversationId: string }
  | { name: 'settings'; returnTo: View }
  | { name: 'teams' }
  | { name: 'team-editor'; team: Team | null; returnTo: View }
  | { name: 'team'; teamId: string; conversationId: string }
  | { name: 'team-details'; teamId: string; conversationId: string }

export function Panel(): React.JSX.Element {
  const [state, setState] = useState<PanelState>({ open: false, corner: 'bottom-right', requestedAt: 0 })
  const [view, setView] = useState<View>({ name: 'gallery' })
  const { agents, error, reload, save, remove, setFavorite } = useAgents()
  const { teams, reload: reloadTeams } = useTeams()
  const openSettings = (): void =>
    setView((current) => (current.name === 'settings' ? current : { name: 'settings', returnTo: current }))

  useEffect(() => window.toolbox.panel.onState(setState), [])
  useEffect(
    () =>
      window.toolbox.panel.onNavigate((target) => {
        if (target === 'settings') openSettings()
        else if ('teamId' in target) setView({ name: 'team', teamId: target.teamId, conversationId: target.conversationId })
        else setView({ name: 'agent', agentId: target.agentId, conversationId: target.conversationId })
      }),
    []
  )

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

  /** Rouvre la dernière conversation de l'équipe, ou en commence une nouvelle. */
  async function openTeam(team: Team): Promise<void> {
    // L'équipe travaille encore : on revient sur ce travail en cours.
    const active = workingConversation(team.id)
    if (active) {
      setView({ name: 'team', teamId: team.id, conversationId: active })
      return
    }
    const conversations = await window.toolbox.team.conversations(team.id)
    setView({ name: 'team', teamId: team.id, conversationId: conversations[0]?.id ?? crypto.randomUUID() })
  }

  const viewTeam = view.name === 'team' || view.name === 'team-details' ? teams.find((team) => team.id === view.teamId) : undefined

  const conversationAgent =
    view.name === 'agent' || view.name === 'details' ? agents.find((agent) => agent.id === view.agentId) : undefined

  return (
    <AvatarPausedContext.Provider value={!state.open}>
    <main
      // Panneau caché : ses animations CSS s'arrêtent pour ne pas consommer de CPU.
      className={state.open ? 'panel' : 'panel panel-closed'}
    >
      {error && (
        <p className="banner-error" role="alert">
          {error}
        </p>
      )}
      {view.name === 'teams' ? (
        <TeamsList
          teams={teams}
          agents={agents}
          onBack={() => setView({ name: 'gallery' })}
          onOpen={(team) => void openTeam(team)}
          onCreate={() => setView({ name: 'team-editor', team: null, returnTo: { name: 'teams' } })}
        />
      ) : view.name === 'team-editor' ? (
        <TeamEditor
          team={view.team}
          agents={agents}
          onCancel={() => setView(view.returnTo)}
          onSaved={(team) => {
            reloadTeams()
            setView({ name: 'team', teamId: team.id, conversationId: crypto.randomUUID() })
          }}
          onDeleted={() => {
            reloadTeams()
            setView({ name: 'teams' })
          }}
        />
      ) : view.name === 'team' && viewTeam ? (
        <TeamChat
          team={viewTeam}
          agents={agents}
          conversationId={view.conversationId}
          panelOpen={state.open}
          onBack={() => setView({ name: 'teams' })}
          onNew={() => setView({ ...view, conversationId: crypto.randomUUID() })}
          onDetails={() => setView({ ...view, name: 'team-details' })}
          onEdit={() => setView({ name: 'team-editor', team: viewTeam, returnTo: view })}
          onOpenChiefConversation={(agentId, conversationId) => setView({ name: 'agent', agentId, conversationId })}
        />
      ) : view.name === 'team-details' && viewTeam ? (
        <TeamDetails
          team={viewTeam}
          currentConversationId={view.conversationId}
          onBack={() => setView({ ...view, name: 'team' })}
          onOpenConversation={(conversationId) => setView({ name: 'team', teamId: view.teamId, conversationId })}
          onNewConversation={() => setView({ name: 'team', teamId: view.teamId, conversationId: crypto.randomUUID() })}
          onEdit={() => setView({ name: 'team-editor', team: viewTeam, returnTo: view })}
        />
      ) : view.name === 'settings' ? (
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
          onOpenConversation={(conversationId) => setView({ ...view, conversationId })}
          onEdit={() => setView({ name: 'wizard', agent: conversationAgent })}
          onOpenSettings={openSettings}
          switcher={<AgentSwitcher agent={conversationAgent} agents={agents} onSwitch={(agent) => void openAgent(agent)} />}
        />
      ) : (
        <Gallery
          agents={agents}
          panelOpen={state.open}
          onOpen={(agent) => void openAgent(agent)}
          onOpenConversation={(agentId, conversationId) => {
            void window.toolbox.agents.markUsed(agentId)
            setView({ name: 'agent', agentId, conversationId })
          }}
          onOpenSettings={openSettings}
          onCreate={() => setView({ name: 'wizard', agent: null })}
          onOpenTeam={() => {
            reloadTeams()
            setView({ name: 'teams' })
          }}
          onEdit={(agent) => setView({ name: 'wizard', agent })}
          onRemove={remove}
          onToggleFavorite={(agent) => setFavorite(agent.id, !agent.isFavorite)}
        />
      )}
    </main>
    </AvatarPausedContext.Provider>
  )
}
