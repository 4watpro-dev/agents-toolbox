import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import type { AgentDraft } from '../../../shared/agent'
import { ACCEPTED_EXTENSIONS } from '../../../shared/attachments'
import type { AvatarState } from '../../../shared/avatar'
import { activityLabel } from '../../../shared/tools'
import { Avatar } from '../../avatar/Avatar'
import { ActionCard } from './ActionCard'
import { PaperclipIcon } from '../icons'
import { AttachmentList } from './AttachmentList'
import { MessageBubble } from './MessageBubble'
import { WorkingLine } from './WorkingLine'
import {
  loadChatSession,
  retryChatMessage,
  sendChatMessage,
  stopChatMessage,
  undoRemembered,
  useChatSession
} from './chatStore'
import { readAttachments, toSendable, type PendingAttachment } from './pendingAttachments'

// Réessayer n'y changerait rien : il faut d'abord régler la connexion.
const CONNECTION_ERRORS = new Set(['missing_key', 'invalid_key', 'not_logged_in', 'not_on_plan', 'cli_missing'])

interface ChatViewProps {
  sessionId: string
  agent: AgentDraft
  /** `null` : essai depuis l'assistant, dont rien n'est conservé. */
  agentId: string | null
  panelOpen: boolean
  subtitle?: string
  backLabel: string
  onBack(): void
  onNew(): void
  onEdit?(): void
  onDetails?(): void
  onOpenSettings(): void
  /** Sélecteur d'agent : remplace le titre fixe de l'en-tête. */
  switcher?: React.ReactNode
}

export function ChatView({
  sessionId,
  agent,
  agentId,
  panelOpen,
  subtitle,
  backLabel,
  onBack,
  onNew,
  onEdit,
  onDetails,
  onOpenSettings,
  switcher
}: ChatViewProps): React.JSX.Element {
  const chat = useChatSession(sessionId)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [attachProblems, setAttachProblems] = useState<string[]>([])
  const [dropping, setDropping] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const filePicker = useRef<HTMLInputElement>(null)
  // Compte les entrées et sorties de glisser : les enfants en déclenchent aussi.
  const dragDepth = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)
  const stuckToBottom = useRef(true)

  // Début de l'attente, pour afficher le temps écoulé pendant la réflexion.
  const [busySince, setBusySince] = useState<number | null>(null)
  useEffect(() => setBusySince(chat.busy ? Date.now() : null), [chat.busy])

  const avatarState: AvatarState = chat.busy ? 'thinking' : input.trim() || pending.length > 0 ? 'listening' : chat.mood

  async function addFiles(files: File[], pasted = false): Promise<void> {
    if (files.length === 0) return
    const { added, problems } = await readAttachments(files, pending.length, pasted)
    setPending((current) => [...current, ...added])
    setAttachProblems(problems)
    field.current?.focus()
  }

  function hasFiles(event: DragEvent): boolean {
    return event.dataTransfer.types.includes('Files')
  }

  function onDragEnter(event: DragEvent): void {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDropping(true)
  }

  function onDragLeave(event: DragEvent): void {
    if (!hasFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropping(false)
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault()
    dragDepth.current = 0
    setDropping(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>): void {
    const files = Array.from(event.clipboardData.files)
    // Du texte copié reste du texte : seuls les fichiers et images deviennent des pièces jointes.
    if (files.length === 0) return
    event.preventDefault()
    void addFiles(files, true)
  }

  useEffect(() => {
    if (agentId) void loadChatSession(agentId, sessionId)
    stuckToBottom.current = true
  }, [agentId, sessionId])

  useEffect(() => {
    if (panelOpen) field.current?.focus()
  }, [panelOpen, sessionId])

  // Suit la réponse, sauf si la personne est remontée lire plus haut.
  useEffect(() => {
    const element = scroller.current
    if (element && stuckToBottom.current) element.scrollTop = element.scrollHeight
  }, [chat.messages, chat.activity, chat.actions, chat.failure, chat.notice, chat.remembered])

  function send(): void {
    const text = input.trim()
    if ((!text && pending.length === 0) || chat.busy) return
    stuckToBottom.current = true
    setInput('')
    setPending([])
    setAttachProblems([])
    sendChatMessage(sessionId, agent, text, agentId, toSendable(pending))
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Pendant une composition (accents, dictée), Entrée valide le caractère, pas le message.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  return (
    <div
      className="view chat-view"
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault()
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dropping && (
        <div className="chat-drop" aria-hidden="true">
          <p>Dépose ici pour joindre à {agent.name}</p>
          <small>Images, PDF et fichiers texte</small>
        </div>
      )}
      <header className="chat-header">
        <button type="button" className="button-back" onClick={onBack} aria-label={backLabel}>
          ‹
        </button>
        <Avatar config={agent.avatar} state={avatarState} size={58} groundShadow={false} label={`Avatar de ${agent.name}`} />
        {switcher ?? (
          <div className="chat-title">
            <h1>{agent.name}</h1>
            <p>{subtitle ?? agent.specialty}</p>
          </div>
        )}
        <button
          type="button"
          className="button-icon"
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
          disabled={chat.messages.length === 0}
          onClick={onNew}
        >
          ＋
        </button>
        {onDetails && (
          <button type="button" className="button-icon" aria-label="Historique et mémoire" title="Historique et mémoire" onClick={onDetails}>
            ☰
          </button>
        )}
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
          <MessageBubble key={message.id} role={message.role} text={message.text} attachments={message.attachments} />
        ))}
        {chat.actions.map((action) => (
          <ActionCard key={action.id} action={action} agentName={agent.name} onAnswer={(approved) => window.toolbox.chat.confirm(action.id, approved)} />
        ))}
        {chat.busy && chat.actions.some((action) => !action.outcome) ? null : (
          <>
            {chat.busy && chat.activity && <WorkingLine text={activityLabel(agent.name, chat.activity)} since={busySince ?? undefined} />}
            {chat.busy && !chat.activity && chat.messages.at(-1)?.role === 'user' && (
              <WorkingLine text={`${agent.name} réfléchit…`} since={busySince ?? undefined} />
            )}
          </>
        )}
        {agentId &&
          chat.remembered.map((fact) => (
            <div key={fact} className="chat-remembered" role="status">
              <span>
                <strong>{agent.name} retient :</strong> {fact}
              </span>
              <button type="button" className="button" onClick={() => void undoRemembered(sessionId, agentId, fact)}>
                Retirer
              </button>
            </div>
          ))}
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
                <button type="button" className="button" onClick={() => retryChatMessage(sessionId, agent, agentId)}>
                  Réessayer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="chat-input">
        {(pending.length > 0 || attachProblems.length > 0) && (
          <div className="chat-pending">
            {pending.length > 0 && (
              <AttachmentList
                attachments={pending}
                onRemove={(index) => setPending((current) => current.filter((_, i) => i !== index))}
              />
            )}
            {attachProblems.map((problem) => (
              <p key={problem} className="chat-attach-problem" role="alert">
                {problem}
              </p>
            ))}
          </div>
        )}
        <button
          type="button"
          className="chat-attach"
          aria-label="Joindre des fichiers"
          title="Joindre des images, PDF ou fichiers texte"
          disabled={chat.busy}
          onClick={() => filePicker.current?.click()}
        >
          <PaperclipIcon size={19} />
        </button>
        <input
          ref={filePicker}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_EXTENSIONS}
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <textarea
          ref={field}
          className="input"
          rows={2}
          placeholder={`Écrire à ${agent.name}…`}
          aria-label={`Écrire à ${agent.name}`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        {chat.busy ? (
          <button type="button" className="button" onClick={() => stopChatMessage(sessionId)}>
            Arrêter
          </button>
        ) : (
          <button type="button" className="button button-primary" disabled={!input.trim() && pending.length === 0} onClick={send}>
            Envoyer
          </button>
        )}
      </footer>
    </div>
  )
}
