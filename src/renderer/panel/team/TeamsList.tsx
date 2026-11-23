import type { Agent } from '../../../shared/agent'
import { teamReady, type Team } from '../../../shared/teams'
import { Avatar } from '../../avatar/Avatar'

interface TeamsListProps {
  teams: Team[]
  agents: Agent[]
  onBack(): void
  onOpen(team: Team): void
  onCreate(): void
}

/** Avatars superposés : le chef devant, puis ses membres. */
export function TeamAvatars({ team, agents, size = 30 }: { team: Team; agents: Agent[]; size?: number }): React.JSX.Element {
  const people = [team.chiefId, ...team.memberIds]
    .map((id) => agents.find((agent) => agent.id === id))
    .filter((agent): agent is Agent => Boolean(agent))
    .slice(0, 5)
  return (
    <span className="team-avatars" aria-hidden="true">
      {people.map((agent) => (
        <span key={agent.id} className="team-avatar">
          <Avatar config={agent.avatar} size={size} groundShadow={false} floating={false} />
        </span>
      ))}
    </span>
  )
}

export function TeamsList({ teams, agents, onBack, onOpen, onCreate }: TeamsListProps): React.JSX.Element {
  const agentIds = agents.map((agent) => agent.id)
  const nameOf = (id: string | null): string => agents.find((agent) => agent.id === id)?.name ?? '?'

  return (
    <div className="view">
      <header className="view-header">
        <button type="button" className="button-back" onClick={onBack} aria-label="Retour à la galerie">
          ‹
        </button>
        <h1>Équipes</h1>
      </header>
      <div className="view-body">
        {teams.length === 0 ? (
          <p className="empty">
            Aucune équipe pour l'instant. Une équipe réunit un chef d'orchestre et 1 à 4 agents, qui travaillent ensemble sur tes
            demandes.
          </p>
        ) : (
          <ul className="team-cards">
            {teams.map((team) => {
              const ready = teamReady(team, agentIds)
              const members = team.memberIds.filter((id) => agentIds.includes(id))
              return (
                <li key={team.id}>
                  <button type="button" className="team-card" onClick={() => onOpen(team)}>
                    <TeamAvatars team={team} agents={agents} />
                    <span className="team-card-body">
                      <span className="team-card-name">{team.name}</span>
                      <span className="team-card-meta">
                        {ready
                          ? `Chef : ${nameOf(team.chiefId)} · ${members.length} membre${members.length > 1 ? 's' : ''}`
                          : 'À compléter : il manque un chef ou des membres'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <footer className="view-footer">
        <button type="button" className="button button-primary button-wide" disabled={agents.length < 2} onClick={onCreate}>
          + Créer une équipe
        </button>
      </footer>
    </div>
  )
}
