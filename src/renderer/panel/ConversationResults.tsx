import type { Agent } from '../../shared/agent'
import type { SearchHit } from '../../shared/history'
import { Avatar } from '../avatar/Avatar'
import { PinIcon } from './icons'

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

interface ConversationResultsProps {
  hits: SearchHit[]
  agents: Agent[]
  onOpen(agentId: string, conversationId: string): void
}

/** Conversations qui contiennent le texte cherché, avec l'extrait qui le montre. */
export function ConversationResults({ hits, agents, onOpen }: ConversationResultsProps): React.JSX.Element {
  return (
    <section className="search-results" aria-label="Conversations trouvées">
      <h2 className="search-results-title">
        Conversations <span>{hits.length}</span>
      </h2>
      <ul className="search-hits">
        {hits.map((hit) => {
          const agent = agents.find((candidate) => candidate.id === hit.agentId)
          if (!agent) return null
          return (
            <li key={hit.conversationId}>
              <button type="button" className="search-hit" onClick={() => onOpen(hit.agentId, hit.conversationId)}>
                <Avatar config={agent.avatar} size={30} groundShadow={false} floating={false} />
                <span className="search-hit-body">
                  <span className="search-hit-head">
                    <span className="search-hit-title">{hit.title || 'Conversation'}</span>
                    {hit.pinned && <PinIcon size={13} filled />}
                    <span className="search-hit-meta">
                      {agent.name} · {DATE_FORMAT.format(new Date(hit.updatedAt))}
                      {hit.count > 1 ? ` · ${hit.count} occurrences` : ''}
                    </span>
                  </span>
                  <span className="search-hit-snippet">
                    {hit.snippet.before}
                    <mark>{hit.snippet.match}</mark>
                    {hit.snippet.after}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
