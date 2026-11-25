import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Agent } from '../../../shared/agent'
import { teamReady, type Team } from '../../../shared/teams'
import { Avatar } from '../../avatar/Avatar'
import { MessageBubble } from '../chat/MessageBubble'
import { TeamAvatars } from './TeamsList'
import { activityLabel } from '../../../shared/tools'
import { useNow, WorkingLine } from '../chat/WorkingLine'
import { exportTitle } from '../chat/exportTitle'
import { formatElapsed, teamSteps, type MemberStatus, type TeamRun } from './teamState'
import { loadTeamConversation, startTeamRun, useTeamRuns } from './teamStore'

interface TeamProgressProps {
  run: TeamRun
  chiefName: string
  nameOf(agentId: string): string
  elapsed: string
}

/** Barre de progression d'une demande : un segment par étape, l'étape en cours scintille. */
function TeamProgress({ run, chiefName, nameOf, elapsed }: TeamProgressProps): React.JSX.Element {
  const steps = teamSteps(run, chiefName, nameOf)
  const currentIndex = steps.findIndex((step) => step.state === 'current')
  const current = steps[currentIndex]
  return (
    <div className="team-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={Math.max(currentIndex, 0)}>
      <p className="team-progress-label">
        <span>
          {current ? (
            <>
              Étape {currentIndex + 1} sur {steps.length} · <strong>{current.label}</strong>
            </>
          ) : (
            'Travail interrompu'
          )}
        </span>
        {current && <span className="working-time">{elapsed}</span>}
      </p>
      <div className="team-progress-track">
        {steps.map((step) => (
          <span key={step.key} className={`team-progress-step is-${step.state}`} title={step.label} />
        ))}
      </div>
    </div>
  )
}

const REMARK_PLUGINS = [remarkGfm]

const STATUS_LABELS: Record<MemberStatus, string> = {
  waiting: 'en attente',
  working: 'au travail…',
  done: 'terminé',
  error: 'en échec'
}

interface TeamChatProps {
  team: Team
  agents: Agent[]
  conversationId: string
  panelOpen: boolean
  onBack(): void
  onNew(): void
  onDetails(): void
  onEdit(): void
  onOpenChiefConversation(agentId: string, conversationId: string): void
}

/** Conversation d'une équipe : les demandes passées, et le travail en direct de la demande en cours. */
export function TeamChat({
  team,
  agents,
  conversationId,
  panelOpen,
  onBack,
  onNew,
  onDetails,
  onEdit,
  onOpenChiefConversation
}: TeamChatProps): React.JSX.Element {
  const runs = useTeamRuns(conversationId)
  const [input, setInput] = useState('')
  const [copyError, setCopyError] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const thread = useRef<HTMLDivElement>(null)

  const chief = agents.find((agent) => agent.id === team.chiefId) ?? null
  const ready = teamReady(team, agents.map((agent) => agent.id))
  const running = runs.at(-1)?.status === 'running'
  const now = useNow(running)
  const since = (run: TeamRun): string => (run.stepStartedAt ? ` · ${formatElapsed(now - run.stepStartedAt)}` : '')
  const elapsed = (run: TeamRun): string => (run.stepStartedAt ? formatElapsed(now - run.stepStartedAt) : '')
  const doing = (run: TeamRun, agentId: string, name: string): string | null => {
    const activity = run.activity?.[agentId]
    return activity ? activityLabel(name, activity) : null
  }
  const nameOf = (run: TeamRun, id: string): string => agents.find((agent) => agent.id === id)?.name ?? run.names?.[id] ?? 'Un membre'

  // Conversation rouverte : depuis l'historique, ou en cours de travail si on revient pendant qu'elle tourne.
  useEffect(() => {
    void loadTeamConversation(team.id, conversationId)
  }, [team.id, conversationId])

  useEffect(() => {
    if (panelOpen) field.current?.focus()
  }, [panelOpen, conversationId])

  useEffect(() => {
    const element = thread.current
    if (element) element.scrollTop = element.scrollHeight
  }, [runs])

  function send(): void {
    const text = input.trim()
    if (!text || !ready || running) return
    setInput('')
    startTeamRun(team.id, conversationId, text)
  }

  async function continueWithChief(): Promise<void> {
    setCopyError(null)
    const result = await window.toolbox.team.continueWithChief(team.id, conversationId)
    if (result.ok) onOpenChiefConversation(result.value.agentId, result.value.conversationId)
    else setCopyError(result.message)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send()
    }
  }

  const lastDone = runs.at(-1)?.status === 'done'

  return (
    <div className="view">
      <header className="chat-header">
        <button type="button" className="button-back" onClick={onBack} aria-label="Retour aux équipes">
          ‹
        </button>
        <TeamAvatars team={team} agents={agents} size={34} />
        <div className="chat-title">
          <h1>{team.name}</h1>
          <p>{chief ? `Chef : ${chief.name}` : 'Sans chef'}</p>
        </div>
        <button
          type="button"
          className="button-icon"
          aria-label="Nouvelle conversation d'équipe"
          title="Nouvelle conversation"
          disabled={runs.length === 0 || running}
          onClick={onNew}
        >
          ＋
        </button>
        <button type="button" className="button-icon" aria-label="Historique et tâches de l'équipe" title="Historique et tâches" onClick={onDetails}>
          ☰
        </button>
        <button type="button" className="button-icon" aria-label={`Modifier ${team.name}`} title="Modifier l'équipe" onClick={onEdit}>
          ✎
        </button>
      </header>

      <div className="view-body team-body" ref={thread}>
        {!ready && (
          <div className="chat-failure" role="alert">
            <p>Il manque un chef ou des membres à cette équipe.</p>
            <div className="chat-failure-actions">
              <button type="button" className="button" onClick={onEdit}>
                Compléter l'équipe
              </button>
            </div>
          </div>
        )}
        {ready && runs.length === 0 && (
          <p className="field-hint">
            {chief?.name} répartit le travail, chaque membre fait sa part en voyant celle des précédents, puis {chief?.name} rédige
            la réponse. Comptez une réponse par membre sollicité, plus deux pour le chef.
          </p>
        )}

        {runs.map((run) => (
          <section key={run.id} className="team-run">
            {run.scheduled && <p className="team-scheduled">Tâche programmée</p>}
            <MessageBubble role="user" text={run.request} />
            {run.status === 'running' && (
              <TeamProgress run={run} chiefName={chief?.name ?? 'Le chef'} nameOf={(agentId) => nameOf(run, agentId)} elapsed={elapsed(run)} />
            )}
            <div className="team-plan">
              <p className="team-plan-title">
                {chief && <Avatar config={chief.avatar} size={22} groundShadow={false} floating={false} />}
                {run.phase === 'plan' && run.status === 'running' ? (
                  <WorkingLine text={`${chief?.name ?? 'Le chef'} répartit le travail`} bar={false} />
                ) : run.assignments.length > 0
                    ? 'Travail confié :'
                    : `${chief?.name ?? 'Le chef'} a répondu seul.`}
              </p>
              {run.assignments.length > 0 && (
                <ol className="team-assignments">
                  {run.assignments.map((assignment) => {
                    const output = run.outputs[assignment.agentId]
                    const agent = agents.find((candidate) => candidate.id === assignment.agentId)
                    return (
                      <li key={assignment.agentId} className={`team-assignment is-${output?.status ?? 'waiting'}`}>
                        <details open={output?.status === 'working'}>
                          <summary>
                            {agent && <Avatar config={agent.avatar} size={22} groundShadow={false} floating={false} />}
                            <span className="team-assignment-head">
                              <strong>{nameOf(run, assignment.agentId)}</strong>
                              <span className="team-status">
                                {output?.status === 'working' && run.status === 'running' ? (
                                  <>
                                    au travail
                                    <span className="working-dots" aria-hidden="true">
                                      <i />
                                      <i />
                                      <i />
                                    </span>
                                    {since(run)}
                                  </>
                                ) : (
                                  STATUS_LABELS[output?.status ?? 'waiting']
                                )}
                              </span>
                            </span>
                          </summary>
                          <p className="team-task">{assignment.task}</p>
                          {output?.status === 'working' && doing(run, assignment.agentId, nameOf(run, assignment.agentId)) && (
                            <p className="team-doing">{doing(run, assignment.agentId, nameOf(run, assignment.agentId))}</p>
                          )}
                          {output?.problem && <p className="form-error">{output.problem}</p>}
                          {output?.text && (
                            <div className="team-output">
                              <Markdown remarkPlugins={REMARK_PLUGINS}>{output.text}</Markdown>
                            </div>
                          )}
                        </details>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
            {run.phase === 'synthesis' && run.status === 'running' && !run.answer && (
              <WorkingLine text={(chief && doing(run, chief.id, chief.name)) ?? `${chief?.name ?? 'Le chef'} rédige la réponse de l'équipe`} />
            )}
            {run.answer && <MessageBubble role="assistant" text={run.answer} exportTitle={exportTitle(`Équipe ${team.name}`, run.request)} />}
            {run.status === 'error' && (
              <p className="form-error" role="alert">
                Échec : {run.error}
              </p>
            )}
            {run.status === 'stopped' && <p className="chat-notice">Travail d'équipe interrompu.</p>}
          </section>
        ))}

        {lastDone && chief && (
          <button type="button" className="link-button team-open" onClick={() => void continueWithChief()}>
            Continuer seul avec {chief.name}
          </button>
        )}
        {copyError && <p className="form-error">{copyError}</p>}
      </div>

      <footer className="chat-input">
        <textarea
          ref={field}
          className="input"
          rows={2}
          placeholder={ready ? `Demander à l'équipe ${team.name}…` : 'Complète d’abord l’équipe'}
          aria-label={`Demande à l'équipe ${team.name}`}
          disabled={!ready}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {running ? (
          <button type="button" className="button" onClick={() => window.toolbox.team.stop(conversationId)}>
            Arrêter
          </button>
        ) : (
          <button type="button" className="button button-primary" disabled={!ready || !input.trim()} onClick={send}>
            Envoyer
          </button>
        )}
      </footer>
    </div>
  )
}
