import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, type Agent } from '../../shared/agent'
import { filterAgents } from '../../shared/gallery'
import { AgentCard } from './AgentCard'

interface GalleryProps {
  agents: Agent[]
  panelOpen: boolean
  onOpen(agent: Agent): void
  onOpenSettings(): void
  onCreate(): void
  onEdit(agent: Agent): void
  onRemove(agent: Agent): void
  onToggleFavorite(agent: Agent): void
}

export function Gallery({
  agents,
  panelOpen,
  onOpen,
  onOpenSettings,
  onCreate,
  onEdit,
  onRemove,
  onToggleFavorite
}: GalleryProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (panelOpen) search.current?.focus()
  }, [panelOpen])

  // Une catégorie personnalisée (arrivée par un import) doit rester filtrable.
  const categories = useMemo(
    () => [...new Set<string>([...CATEGORIES, ...agents.map((agent) => agent.category)])],
    [agents]
  )
  const visible = useMemo(() => filterAgents(agents, { query, category }), [agents, query, category])

  return (
    <div className="view">
      <header className="gallery-header">
        <div className="gallery-search">
          <input
            ref={search}
            className="input"
            type="search"
            placeholder="Rechercher un agent"
            aria-label="Rechercher un agent"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className="button-icon" aria-label="Réglages" title="Réglages" onClick={onOpenSettings}>
            ⚙
          </button>
        </div>
        <div className="chips" role="group" aria-label="Filtrer par catégorie">
          <button type="button" className="chip" aria-pressed={category === null} onClick={() => setCategory(null)}>
            Tous
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              className="chip"
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </header>

      <div className="view-body">
        {visible.length > 0 ? (
          <ul className="card-grid">
            {visible.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => onOpen(agent)}
                onEdit={() => onEdit(agent)}
                onRemove={() => onRemove(agent)}
                onToggleFavorite={() => onToggleFavorite(agent)}
              />
            ))}
          </ul>
        ) : (
          <p className="empty">
            {agents.length === 0 ? "Aucun agent pour l'instant. Crée le premier !" : 'Aucun agent ne correspond.'}
          </p>
        )}
      </div>

      <footer className="view-footer">
        <button type="button" className="button button-primary button-wide" onClick={onCreate}>
          + Créer un agent
        </button>
      </footer>
    </div>
  )
}
