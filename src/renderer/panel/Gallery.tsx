import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, type Agent } from '../../shared/agent'
import { filterAgents } from '../../shared/gallery'
import { MIN_QUERY_LENGTH, type SearchHit } from '../../shared/history'
import type { TransferResult } from '../../shared/ipc'
import { AgentCard } from './AgentCard'
import { ConversationResults } from './ConversationResults'
import { TeamIcon } from './icons'

/** Attente après la dernière frappe avant de chercher dans les conversations. */
const SEARCH_DELAY_MS = 180

interface GalleryProps {
  agents: Agent[]
  panelOpen: boolean
  onOpen(agent: Agent): void
  onOpenConversation(agentId: string, conversationId: string): void
  onOpenSettings(): void
  onCreate(): void
  onOpenTeam(): void
  onEdit(agent: Agent): void
  onRemove(agent: Agent): void
  onToggleFavorite(agent: Agent): void
}

export function Gallery({
  agents,
  panelOpen,
  onOpen,
  onOpenConversation,
  onOpenSettings,
  onCreate,
  onOpenTeam,
  onEdit,
  onRemove,
  onToggleFavorite
}: GalleryProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null)
  const [hits, setHits] = useState<SearchHit[]>([])
  const search = useRef<HTMLInputElement>(null)

  // La même recherche fouille aussi les conversations, une fois la frappe posée.
  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setHits([])
      return
    }
    let current = true
    const timer = setTimeout(() => {
      void window.toolbox.conversations.search(query).then((found) => {
        if (current) setHits(found)
      })
    }, SEARCH_DELAY_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [query])

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
            placeholder="Rechercher un agent ou une conversation"
            aria-label="Rechercher un agent ou une conversation"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            className="button-icon"
            aria-label="Équipes"
            title="Équipes"
            disabled={agents.length < 2}
            onClick={onOpenTeam}
          >
            <TeamIcon size={18} />
          </button>
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
        {transferResult && !(transferResult.ok && transferResult.value.canceled) && (
          <p className={transferResult.ok ? 'gallery-notice' : 'gallery-notice form-error'} role="status">
            {transferResult.ok ? transferResult.value.message : transferResult.message}
          </p>
        )}
        {visible.length > 0 ? (
          <ul className="card-grid">
            {visible.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onOpen={() => onOpen(agent)}
                onEdit={() => onEdit(agent)}
                onExport={() => void window.toolbox.agents.exportToFile(agent.id).then(setTransferResult)}
                onRemove={() => onRemove(agent)}
                onToggleFavorite={() => onToggleFavorite(agent)}
              />
            ))}
          </ul>
        ) : hits.length === 0 ? (
          <p className="empty">
            {agents.length === 0
              ? "Aucun agent pour l'instant. Crée le premier !"
              : query.trim().length >= MIN_QUERY_LENGTH
                ? 'Aucun agent ni aucune conversation ne correspond.'
                : 'Aucun agent ne correspond.'}
          </p>
        ) : null}
        {hits.length > 0 && <ConversationResults hits={hits} agents={agents} onOpen={onOpenConversation} />}
      </div>

      <footer className="view-footer">
        <button type="button" className="button button-primary button-wide" onClick={onCreate}>
          + Créer un agent
        </button>
      </footer>
    </div>
  )
}
