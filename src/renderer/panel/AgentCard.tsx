import { useState, type KeyboardEvent } from 'react'
import type { Agent } from '../../shared/agent'
import { Avatar } from '../avatar/Avatar'

interface AgentCardProps {
  agent: Agent
  onOpen(): void
  onEdit(): void
  onRemove(): void
  onToggleFavorite(): void
}

type Overlay = 'none' | 'menu' | 'confirm'

export function AgentCard({ agent, onOpen, onEdit, onRemove, onToggleFavorite }: AgentCardProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)
  const [overlay, setOverlay] = useState<Overlay>('none')

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && overlay !== 'none') {
      // Échap ferme d'abord le menu : le panneau reste ouvert.
      event.preventDefault()
      setOverlay('none')
    }
  }

  return (
    <li
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        if (overlay === 'menu') setOverlay('none')
      }}
      onKeyDown={onKeyDown}
    >
      <button type="button" className="card-open" onClick={onOpen}>
        {/* Une grille de flottements continus coûterait cher : seule la carte survolée flotte. */}
        <Avatar config={agent.avatar} size={72} floating={hovered} />
        <span className="card-name">{agent.name}</span>
        <span className="card-specialty">{agent.specialty}</span>
      </button>

      <button
        type="button"
        className={agent.isFavorite ? 'card-icon card-star is-on' : 'card-icon card-star'}
        aria-label={agent.isFavorite ? `Retirer ${agent.name} des favoris` : `Épingler ${agent.name} en favori`}
        aria-pressed={agent.isFavorite}
        onClick={onToggleFavorite}
      >
        {agent.isFavorite ? '★' : '☆'}
      </button>

      <button
        type="button"
        className="card-icon card-more"
        aria-label={`Actions pour ${agent.name}`}
        aria-expanded={overlay === 'menu'}
        onClick={() => setOverlay(overlay === 'menu' ? 'none' : 'menu')}
      >
        ⋯
      </button>

      {overlay === 'menu' && (
        <div className="card-menu" role="menu">
          <button type="button" role="menuitem" onClick={onEdit}>
            Modifier
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => setOverlay('confirm')}>
            Supprimer
          </button>
        </div>
      )}

      {overlay === 'confirm' && (
        <div className="card-confirm" role="alertdialog" aria-label={`Supprimer ${agent.name} ?`}>
          <p>Supprimer {agent.name} ?</p>
          <div className="card-confirm-actions">
            <button type="button" className="button" autoFocus onClick={() => setOverlay('none')}>
              Annuler
            </button>
            <button type="button" className="button button-danger" onClick={onRemove}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
