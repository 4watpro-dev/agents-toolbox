import type { Agent } from '../../shared/agent'
import { Avatar } from '../avatar/Avatar'

interface AgentHomeProps {
  agent: Agent
  onBack(): void
  onEdit(): void
}

/** Écran d'accueil de l'agent. La conversation s'y branche au jalon 4. */
export function AgentHome({ agent, onBack, onEdit }: AgentHomeProps): React.JSX.Element {
  return (
    <div className="view">
      <header className="view-header">
        <button type="button" className="button-back" onClick={onBack} aria-label="Retour à la galerie">
          ‹
        </button>
        <h1>{agent.name}</h1>
        <button type="button" className="button" onClick={onEdit}>
          Modifier
        </button>
      </header>
      <div className="view-body agent-home">
        <Avatar config={agent.avatar} size={130} label={`Avatar de ${agent.name}`} />
        <p className="card-specialty">{agent.specialty}</p>
        {agent.greeting && <p className="bubble">{agent.greeting}</p>}
        <p className="empty">La conversation arrive au prochain jalon.</p>
      </div>
    </div>
  )
}
