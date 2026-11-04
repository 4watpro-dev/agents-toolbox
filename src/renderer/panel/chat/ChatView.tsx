import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AgentDraft } from '../../../shared/agent'
import type { AvatarState } from '../../../shared/avatar'
import { Avatar } from '../../avatar/Avatar'
import { MessageBubble } from './MessageBubble'
import {
  resetChatSession,
  retryChatMessage,
  sendChatMessage,
  stopChatMessage,
  useChatSession
} from './chatStore'

// Réessayer n'y changerait rien : il faut d'abord régler la connexion.
const CONNECTION_ERRORS = new Set(['missing_key', 'invalid_key', 'not_logged_in', 'not_on_plan', 'cli_missing'])

interface ChatViewProps {
  sessionId: string
  agent: AgentDraft
  panelOpen: boolean
  subtitle?: string
  onBack(): void
  backLabel: string
  onEdit?(): void
  onOpenSettings(): void
}

export function ChatView({
  sessionId,
  agent,
  panelOpen,
  subtitle,
  onBack,
  backLabel,
  onEdit,
  onOpenSettings
}: ChatViewProps): React.JSX.Element {
  const chat = useChatSession(sessionId)
  const [input, setInput] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stuckToBottom = useRef(true)

  const avatarState: AvatarState = chat.busy ? 'thinking' : input.trim() ? 'listening' : chat.mood

  useEffect(() => {
    if (panelOpen) field.current?.focus()
  }, [panelOpen, sessionId])

  // Suit la réponse, sauf si la personne est remontée lire plus haut.
  useEffect(() => {
    const element = scroller.current
    if (element && stuckToBottom.current) element.scrollTop = element.scrollHeight
  }, [chat.messages, chat.failure, chat.notice])

  function send(): void {
    const text = input.trim()
    if (!text || chat.busy) return
    stuckToBottom.current = true
    setInput('')
    sendChatMessage(sessionId, agent, text)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Pendant une composition (accents, dictée), Entrée valide le caractère, pas le message.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div className="view">
      <header className="chat-header">
        <button type="button" className="button-back" onClick={onBack} aria-label={backLabel}>
          ‹
        </button>
        <Avatar config={agent.avatar} state={avatarState} size={58} groundShadow={false} label={`Avatar de ${agent.name}`} />
        <div className="chat-title">
          <h1>{agent.name}</h1>
          <p>{subtitle ?? agent.specialty}</p>
        </div>
        <button
          type="button"
          className="button-icon"
          aria-label="Recommencer la conversation"
          title="Recommencer la conversation"
          disabled={chat.messages.length === 0}
          onClick={() => resetChatSession(sessionId)}
        >
          ⟲
        </button>
        {onEdit && (
          <button type="button" className="button-icon" aria-label={`Modifier ${agent.name}`} title="Modifier" onClick={onEdit}>
            ✎
          </button>
        )}
      </header>

      <div
        className="chat-messages"
        ref={scroller}
        aria-live="polite"
        onScroll={(event) => {
          const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
          stuckToBottom.current = scrollHeight - scrollTop - clientHeight < 32
        }}
      >
        {agent.greeting && <MessageBubble role="assistant" text={agent.greeting} />}
        {chat.messages.map((message) => (
          <MessageBubble key={message.id} role={message.role} text={message.text} />
        ))}
        {chat.busy && chat.messages.at(-1)?.role === 'user' && (
          <p className="chat-waiting">{agent.name} réfléchit…</p>
        )}
        {chat.notice && <p className="chat-notice">{chat.notice}</p>}
        {chat.failure && (
          <div className="chat-failure" role="alert">
            <p>{chat.failure.message}</p>
            <div className="chat-failure-actions">
              {CONNECTION_ERRORS.has(chat.failure.code) ? (
                <button type="button" className="button" onClick={onOpenSettings}>
                  Ouvrir les réglages
                </button>
              ) : (
                <button type="button" className="button" onClick={() => retryChatMessage(sessionId, agent)}>
                  Réessayer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="chat-input">
        <textarea
          ref={field}
          className="input"
          rows={2}
          placeholder={`Écrire à ${agent.name}…`}
          aria-label={`Écrire à ${agent.name}`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {chat.busy ? (
          <button type="button" className="button" onClick={() => stopChatMessage(sessionId)}>
            Arrêter
          </button>
        ) : (
          <button type="button" className="button button-primary" disabled={!input.trim()} onClick={send}>
            Envoyer
          </button>
        )}
      </footer>
    </div>
  )
}
