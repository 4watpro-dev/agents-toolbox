import { useCallback, useEffect, useState } from 'react'
import type { Team, TeamConversationSummary } from '../../../shared/teams'
import { TrashIcon } from '../icons'
import { TaskSection } from '../TaskSection'
import { forgetTeamConversation } from './teamStore'

interface TeamDetailsProps {
  team: Team
  currentConversationId: string
  onBack(): void
  onOpenConversation(id: string): void
  onNewConversation(): void
  onEdit(): void
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Historique d'une équipe (ses conversations) et ses tâches programmées. */
export function TeamDetails({ team, currentConversationId, onBack, onOpenConversation, onNewConversation, onEdit }: TeamDetailsProps): React.JSX.Element {
  const [conversations, setConversations] = useState<TeamConversationSummary[] | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    void window.toolbox.team.conversations(team.id).then(setConversations)
  }, [team.id])

  useEffect(() => {
    refresh()
    // Une tâche d'équipe qui se termine ajoute une conversation.
    return window.toolbox.tasks.onChanged(refresh)
  }, [refresh])

  async function remove(id: string): Promise<void> {
    setConfirmingId(null)
    await window.toolbox.team.removeConversation(team.id, id)
    forgetTeamConversation(id)
    refresh()
    if (id === currentConversationId) onNewConversation()
  }

  return (
    <div className="view">
      <header className="view-header">
        <button type="button" className="button-back" onClick={onBack} aria-label="Retour à la conversation">
          ‹
        </button>
        <h1>{team.name}</h1>
        <button type="button" className="button" onClick={onEdit}>
          Modifier l'équipe
        </button>
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
                    <button type="button" className="button button-danger" onClick={() => void remove(conversation.id)}>
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
                        {DATE_FORMAT.format(new Date(conversation.updatedAt))} · {conversation.runCount} demande
                        {conversation.runCount > 1 ? 's' : ''}
                      </span>
                    </button>
                    <div className="history-actions">
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

        <TaskSection owner={{ kind: 'team', id: team.id, name: team.name }} onOpenConversation={onOpenConversation} />
      </div>
    </div>
  )
}
