import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Agent } from '../../shared/agent'
import type { AvatarState } from '../../shared/avatar'
import { activityLabel } from '../../shared/tools'
import { Avatar, AvatarPausedContext } from '../avatar/Avatar'
import { ActionCard } from '../panel/chat/ActionCard'
import { MessageBubble } from '../panel/chat/MessageBubble'
import {
  forgetChatSession,
  retryChatMessage,
  sendChatMessage,
  stopChatMessage,
  useChatSession
} from '../panel/chat/chatStore'
import { initialAgentId, neighborAgentId, paletteOrder } from './paletteAgents'

/** Identifiant d'attente tant qu'aucune question n'est partie : il ne correspond à aucune session. */
const NO_SESSION = 'palette-vide'
const MAX_INPUT_HEIGHT = 120

export function Palette(): React.JSX.Element {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** Conversation en cours dans la palette, et l'agent à qui elle appartient. */
  const [session, setSession] = useState<{ id: string; agentId: string } | null>(null)
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  // La palette démarre cachée : ses avatars restent figés tant qu’elle ne s’ouvre pas.
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const thread = useRef<HTMLDivElement>(null)

  const ordered = useMemo(() => paletteOrder(agents), [agents])
  const agent = ordered.find((candidate) => candidate.id === selectedId) ?? null
  const chat = useChatSession(session?.id ?? NO_SESSION)
  const hasThread = session !== null && (chat.messages.length > 0 || chat.failure !== null)
  const lastAnswer = chat.messages.findLast((message) => message.role === 'assistant')?.text ?? ''
  const avatarState: AvatarState = chat.busy ? 'thinking' : input.trim() ? 'listening' : chat.mood

  // À chaque ouverture : agents à jour, sélection conservée, champ prêt à écrire.
  const refresh = useCallback(async () => {
    const [list, lastUsed] = await Promise.all([window.toolbox.agents.list(), window.toolbox.agents.lastUsed()])
    setAgents(list)
    setSelectedId((current) => initialAgentId(paletteOrder(list), current, lastUsed))
  }, [])

  useEffect(() => {
    void refresh()
    return window.toolbox.palette.onState((isOpen) => {
      setOpen(isOpen)
      if (!isOpen) return
      void refresh()
      field.current?.focus()
      field.current?.select()
    })
  }, [refresh])

  // La fenêtre épouse son contenu : le main la redimensionne. L'élément racine change
  // quand la liste d'agents passe de vide à remplie : on observe alors le nouveau.
  const empty = ordered.length === 0
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const observer = new ResizeObserver(() => window.toolbox.palette.resize(element.offsetHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [empty])

  // Le champ grandit avec le texte, jusqu'à quelques lignes.
  useLayoutEffect(() => {
    const element = field.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [input])

  useEffect(() => {
    const element = thread.current
    if (element) element.scrollTop = element.scrollHeight
  }, [chat.messages, chat.activity, chat.failure, chat.actions])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) window.toolbox.palette.close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function selectAgent(id: string | null): void {
    if (!id || id === selectedId) return
    setSelectedId(id)
    // Une autre personne écoute : la palette repart d'une question neuve.
    if (session && !chat.busy) setSession(null)
    field.current?.focus()
  }

  function newQuestion(): void {
    if (chat.busy) return
    setSession(null)
    setInput('')
    field.current?.focus()
  }

  function send(): void {
    const text = input.trim()
    if (!text || !agent || chat.busy) return
    const current = session && session.agentId === agent.id ? session : { id: crypto.randomUUID(), agentId: agent.id }
    setSession(current)
    setInput('')
    void window.toolbox.agents.markUsed(agent.id)
    sendChatMessage(current.id, agent, text, agent.id)
  }

  function continueInPanel(): void {
    if (!session || chat.busy || chat.messages.length === 0) return
    window.toolbox.palette.continueInPanel(session.agentId, session.id)
    // La conversation vit désormais dans le panneau : la palette repart à neuf.
    forgetChatSession(session.id)
    setSession(null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault()
      continueInPanel()
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      selectAgent(neighborAgentId(ordered, selectedId, event.shiftKey ? -1 : 1))
    } else if (event.metaKey && /^[1-9]$/.test(event.key)) {
      event.preventDefault()
      selectAgent(ordered[Number(event.key) - 1]?.id ?? null)
    } else if (event.metaKey && event.key.toLowerCase() === 'n') {
      event.preventDefault()
      newQuestion()
    }
  }

  if (ordered.length === 0) {
    return (
      <div ref={root} className="palette">
        <p className="palette-empty">Crée d'abord un agent depuis le panneau (clic sur l'icône flottante).</p>
      </div>
    )
  }

  return (
    // Palette cachée : plus de clignement d'yeux, donc plus de rendu inutile.
    <AvatarPausedContext.Provider value={!open}>
    <div ref={root} className="palette">
      <div className="palette-input">
        {agent && <Avatar config={agent.avatar} state={avatarState} size={40} groundShadow={false} floating={false} />}
        <textarea
          ref={field}
          rows={1}
          value={input}
          placeholder={agent ? `Demander à ${agent.name}…` : 'Choisis un agent'}
          aria-label={agent ? `Demander à ${agent.name}` : 'Message'}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
        {chat.busy && (
          <button type="button" className="button" onClick={() => session && stopChatMessage(session.id)}>
            Arrêter
          </button>
        )}
      </div>

      <ul className="palette-agents" aria-label="Agents">
        {ordered.map((candidate, index) => (
          <li key={candidate.id}>
            <button
              type="button"
              className={candidate.id === selectedId ? 'palette-agent is-selected' : 'palette-agent'}
              aria-pressed={candidate.id === selectedId}
              title={index < 9 ? `${candidate.name} (⌘${index + 1})` : candidate.name}
              onClick={() => selectAgent(candidate.id)}
            >
              <Avatar config={candidate.avatar} size={22} groundShadow={false} floating={false} />
              <span>{candidate.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {hasThread && agent && (
        <>
          <div className="palette-thread" ref={thread} aria-live="polite">
            {chat.messages.map((message) => (
              <MessageBubble key={message.id} role={message.role} text={message.text} attachments={message.attachments} />
            ))}
            {chat.actions.map((action) => (
              <ActionCard key={action.id} action={action} agentName={agent.name} onAnswer={(approved) => window.toolbox.chat.confirm(action.id, approved)} />
            ))}
            {chat.busy && chat.activity && <p className="chat-waiting">{activityLabel(agent.name, chat.activity)}</p>}
            {chat.busy && !chat.activity && chat.messages.at(-1)?.role === 'user' && (
              <p className="chat-waiting">{agent.name} réfléchit…</p>
            )}
            {chat.notice && <p className="chat-notice">{chat.notice}</p>}
            {chat.failure && session && (
              <div className="chat-failure" role="alert">
                <p>{chat.failure.message}</p>
                <div className="chat-failure-actions">
                  <button type="button" className="button" onClick={() => retryChatMessage(session.id, agent, agent.id)}>
                    Réessayer
                  </button>
                </div>
              </div>
            )}
          </div>
          <footer className="palette-footer">
            <span className="palette-hints">⌘N nouvelle question · ⌘↩ continuer dans le panneau</span>
            <button
              type="button"
              className="button"
              disabled={!lastAnswer || chat.busy}
              onClick={() => {
                window.toolbox.copyText(lastAnswer)
                setCopied(true)
              }}
            >
              {copied ? 'Copié' : 'Copier la réponse'}
            </button>
            <button type="button" className="button button-primary" disabled={chat.busy} onClick={continueInPanel}>
              Continuer dans le panneau
            </button>
          </footer>
        </>
      )}

      {!hasThread && <p className="palette-hints palette-hints-idle">↩ envoyer · ⇥ changer d'agent · ⌘1–9 choisir · Échap fermer</p>}
    </div>
    </AvatarPausedContext.Provider>
  )
}
