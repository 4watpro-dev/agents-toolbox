import { useCallback, useEffect, useState } from 'react'
import type { Agent } from '../../shared/agent'
import type { ConversationSummary } from '../../shared/conversation'
import type { TransferResult } from '../../shared/ipc'
import { resetChatSession } from './chat/chatStore'
import { ExportIcon, PinIcon, TrashIcon } from './icons'
import { TaskSection } from './TaskSection'

interface AgentDetailsProps {
  agent: Agent
  currentConversationId: string
  onBack(): void
  onOpenConversation(id: string): void
  onNewConversation(): void
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function AgentDetails({
  agent,
  currentConversationId,
  onBack,
  onOpenConversation,
  onNewConversation
}: AgentDetailsProps): React.JSX.Element {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [facts, setFacts] = useState<string[]>([])
  const [newFact, setNewFact] = useState('')
  const [exportResult, setExportResult] = useState<TransferResult | null>(null)

  const refreshConversations = useCallback(() => {
    void window.toolbox.conversations.list(agent.id).then(setConversations)
  }, [agent.id])

  useEffect(() => {
    refreshConversations()
    void window.toolbox.memory.get(agent.id).then(setFacts)
  }, [agent.id, refreshConversations])

  async function removeConversation(id: string): Promise<void> {
    setConfirmingId(null)
    resetChatSession(id)
    await window.toolbox.conversations.remove(agent.id, id)
    refreshConversations()
    if (id === currentConversationId) onNewConversation()
  }

  async function togglePin(conversation: ConversationSummary): Promise<void> {
    await window.toolbox.conversations.setPinned(agent.id, conversation.id, !conversation.pinned)
    refreshConversations()
  }

  async function exportConversation(id: string): Promise<void> {
    setExportResult(await window.toolbox.conversations.exportMarkdown(agent.id, id))
  }

  async function saveFacts(next: string[]): Promise<void> {
    setFacts(await window.toolbox.memory.set(agent.id, next))
  }

  function addFact(): void {
    if (!newFact.trim()) return
    void saveFacts([...facts, newFact])
    setNewFact('')
  }

  return (
    <div className="view">
      <header className="view-header">
        <button type="button" className="button-back" onClick={onBack} aria-label="Retour à la conversation">
          ‹
        </button>
        <h1>{agent.name}</h1>
      </header>
      <div className="view-body wizard-body">
        <section className="settings-section">
          <div className="section-title">
            <h2>Conversations</h2>
            <button type="button" className="button" onClick={onNewConversation}>
              Nouvelle
            </button>
          </div>
          {conversations?.length === 0 && <p className="field-hint">Aucune conversation enregistrée.</p>}
          {exportResult && !(exportResult.ok && exportResult.value.canceled) && (
            <p className={exportResult.ok ? 'field-hint' : 'form-error'} role="status">
              {exportResult.ok ? exportResult.value.message : exportResult.message}
            </p>
          )}
          <ul className="history-list">
            {conversations?.map((conversation) => (
              <li key={conversation.id} className={conversation.pinned ? 'history-item is-pinned' : 'history-item'}>
                {confirmingId === conversation.id ? (
                  <div className="settings-confirm" role="alertdialog" aria-label="Supprimer cette conversation ?">
                    <span>Supprimer cette conversation ?</span>
                    <button type="button" className="button" autoFocus onClick={() => setConfirmingId(null)}>
                      Annuler
                    </button>
                    <button type="button" className="button button-danger" onClick={() => void removeConversation(conversation.id)}>
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="history-open"
                      aria-current={conversation.id === currentConversationId ? 'true' : undefined}
                      onClick={() => onOpenConversation(conversation.id)}
                    >
                      <span className="history-title">
                        {conversation.pinned && <PinIcon size={13} filled />}
                        {conversation.title}
                      </span>
                      <span className="field-hint">
                        {DATE_FORMAT.format(new Date(conversation.updatedAt))} · {conversation.messageCount} messages
                      </span>
                    </button>
                    <div className="history-actions">
                      <button
                        type="button"
                        className={conversation.pinned ? 'history-action is-on' : 'history-action'}
                        aria-label={conversation.pinned ? `Désépingler : ${conversation.title}` : `Épingler : ${conversation.title}`}
                        aria-pressed={conversation.pinned}
                        title={conversation.pinned ? 'Désépingler' : 'Épingler en haut'}
                        onClick={() => void togglePin(conversation)}
                      >
                        <PinIcon size={16} filled={conversation.pinned} />
                      </button>
                      <button
                        type="button"
                        className="history-action"
                        aria-label={`Exporter en Markdown : ${conversation.title}`}
                        title="Exporter en Markdown"
                        onClick={() => void exportConversation(conversation.id)}
                      >
                        <ExportIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className="history-action history-action-danger"
                        aria-label={`Supprimer la conversation : ${conversation.title}`}
                        title="Supprimer"
                        onClick={() => setConfirmingId(conversation.id)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        <TaskSection owner={{ kind: 'agent', id: agent.id, name: agent.name }} onOpenConversation={onOpenConversation} />

        <section className="settings-section">
          <h2>Mémoire</h2>
          <p className="field-hint">Ce que {agent.name} sait de toi. Ces faits restent sur ce Mac et sont envoyés à Claude à chaque message.</p>
          {facts.map((fact, index) => (
            <div key={`${index}-${fact}`} className="memory-row">
              <input
                className="input"
                aria-label={`Fait ${index + 1}`}
                maxLength={200}
                defaultValue={fact}
                onBlur={(event) => {
                  if (event.target.value !== fact) {
                    void saveFacts(facts.map((other, i) => (i === index ? event.target.value : other)))
                  }
                }}
              />
              <button
                type="button"
                className="button-icon"
                aria-label={`Oublier : ${fact}`}
                title="Oublier"
                onClick={() => void saveFacts(facts.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          ))}
          <form
            className="settings-key"
            onSubmit={(event) => {
              event.preventDefault()
              addFact()
            }}
          >
            <input
              className="input"
              placeholder="Ajouter un fait"
              aria-label="Ajouter un fait"
              maxLength={200}
              value={newFact}
              onChange={(event) => setNewFact(event.target.value)}
            />
            <button type="submit" className="button" disabled={!newFact.trim()}>
              Ajouter
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
