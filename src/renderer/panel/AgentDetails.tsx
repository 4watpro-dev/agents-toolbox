import { useCallback, useEffect, useState } from 'react'
import type { Agent } from '../../shared/agent'
import type { ConversationSummary } from '../../shared/conversation'
import { resetChatSession } from './chat/chatStore'

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
          <ul className="history-list">
            {conversations?.map((conversation) => (
              <li key={conversation.id} className="history-item">
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
                      <span className="history-title">{conversation.title}</span>
                      <span className="field-hint">
                        {DATE_FORMAT.format(new Date(conversation.updatedAt))} · {conversation.messageCount} messages
                      </span>
                    </button>
                    <button
                      type="button"
                      className="button-icon"
                      aria-label={`Supprimer la conversation : ${conversation.title}`}
                      title="Supprimer"
                      onClick={() => setConfirmingId(conversation.id)}
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

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
