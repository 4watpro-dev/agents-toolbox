import { useEffect, useState } from 'react'
import type { ConversationSummary } from '../../../shared/conversation'
import { PinIcon, PlusIcon, SidebarIcon } from '../icons'

const SAME_DAY = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const OTHER_DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

const COLLAPSED_KEY = 'agent-toolbox.chat-sidebar-collapsed'

/** Barre réduite ou non : retenu sur ce Mac, pour tous les agents. */
function savedCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function shortDate(iso: string): string {
  const date = new Date(iso)
  return date.toDateString() === new Date().toDateString() ? SAME_DAY.format(date) : OTHER_DAY.format(date)
}

interface ChatSidebarProps {
  agentId: string
  currentConversationId: string
  /** Change quand une réponse est enregistrée : la liste se recharge alors. */
  revision: number
  onOpen(id: string): void
  onNew(): void
  newDisabled: boolean
}

/**
 * Conversations de l'agent, à gauche du chat. Affichée seulement quand
 * le panneau est assez large (voir panel.css) ; sinon, l'historique reste derrière le bouton Historique de l'en-tête.
 */
export function ChatSidebar({ agentId, currentConversationId, revision, onOpen, onNew, newDisabled }: ChatSidebarProps): React.JSX.Element {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [collapsed, setCollapsed] = useState(savedCollapsed)

  function toggle(): void {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // Sans stockage, le choix vaut pour cette session seulement.
    }
  }

  useEffect(() => {
    let live = true
    void window.toolbox.conversations.list(agentId).then((list) => {
      if (live) setConversations(list)
    })
    return () => {
      live = false
    }
  }, [agentId, currentConversationId, revision, collapsed])

  const toggleButton = (
    <button
      type="button"
      className="chat-sidebar-toggle"
      aria-label={collapsed ? 'Afficher les conversations' : 'Réduire les conversations'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Afficher les conversations' : 'Réduire les conversations'}
      onClick={toggle}
    >
      <SidebarIcon size={17} />
    </button>
  )

  if (collapsed) {
    return (
      <nav className="chat-sidebar is-collapsed" aria-label="Conversations">
        {toggleButton}
        <button
          type="button"
          className="chat-sidebar-toggle"
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
          disabled={newDisabled}
          onClick={onNew}
        >
          <PlusIcon size={17} />
        </button>
      </nav>
    )
  }

  return (
    <nav className="chat-sidebar" aria-label="Conversations">
      <div className="chat-sidebar-head">
        <button type="button" className="chat-sidebar-new" disabled={newDisabled} onClick={onNew}>
          <PlusIcon size={14} />
          Nouvelle conversation
        </button>
        {toggleButton}
      </div>
      {conversations.length === 0 ? (
        <p className="chat-sidebar-empty">Aucune conversation enregistrée.</p>
      ) : (
        <ul className="chat-sidebar-list">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                className="chat-sidebar-item"
                aria-current={conversation.id === currentConversationId ? 'true' : undefined}
                title={conversation.title}
                onClick={() => onOpen(conversation.id)}
              >
                <span className="chat-sidebar-title">
                  {conversation.pinned && <PinIcon size={11} filled />}
                  <span>{conversation.title}</span>
                </span>
                <span className="chat-sidebar-date">{shortDate(conversation.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
