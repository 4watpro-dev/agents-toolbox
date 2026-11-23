import { useCallback, useEffect, useState } from 'react'
import type { Agent } from '../../shared/agent'
import type { TaskView } from '../../shared/ipc'
import { DAY_LABELS, describeDate, describeSchedule, DISPLAY_DAYS, WEEKDAYS, type TaskInput } from '../../shared/schedule'
import { TrashIcon } from './icons'

interface TaskSectionProps {
  agent: Agent
  onOpenConversation(id: string): void
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

function emptyInput(agentId: string): TaskInput {
  return { agentId, title: '', prompt: '', schedule: { days: [...WEEKDAYS], time: '09:00' }, enabled: true }
}

function sameDays(a: number[], b: readonly number[]): boolean {
  return a.length === b.length && b.every((day) => a.includes(day))
}

/** Tâches programmées d'un agent : liste, état de la dernière exécution, et formulaire. */
export function TaskSection({ agent, onOpenConversation }: TaskSectionProps): React.JSX.Element {
  const [tasks, setTasks] = useState<TaskView[]>([])
  /** Tâche en cours d'édition : `null` pour une nouvelle, absente quand le formulaire est fermé. */
  const [editing, setEditing] = useState<{ id: string | null; input: TaskInput } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    void window.toolbox.tasks.list(agent.id).then(setTasks)
  }, [agent.id])

  useEffect(() => {
    refresh()
    return window.toolbox.tasks.onChanged(refresh)
  }, [refresh])

  async function save(): Promise<void> {
    if (!editing) return
    const result = await window.toolbox.tasks.save(editing.id, editing.input)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEditing(null)
    setError(null)
    refresh()
  }

  async function toggle(task: TaskView): Promise<void> {
    const { agentId, title, prompt, schedule } = task
    await window.toolbox.tasks.save(task.id, { agentId, title, prompt, schedule, enabled: !task.enabled })
    refresh()
  }

  async function remove(id: string): Promise<void> {
    setConfirmingId(null)
    await window.toolbox.tasks.remove(id)
    refresh()
  }

  const update = (patch: Partial<TaskInput>): void => setEditing((current) => current && { ...current, input: { ...current.input, ...patch } })
  const setDays = (days: number[]): void =>
    setEditing((current) => current && { ...current, input: { ...current.input, schedule: { ...current.input.schedule, days } } })

  return (
    <section className="settings-section">
      <div className="section-title">
        <h2>Tâches programmées</h2>
        {!editing && (
          <button type="button" className="button" onClick={() => setEditing({ id: null, input: emptyInput(agent.id) })}>
            Nouvelle
          </button>
        )}
      </div>
      <p className="field-hint">
        {agent.name} les exécute seul, à l'heure dite, tant que ton Mac est allumé. Une tâche manquée est rattrapée au retour.
        Le résultat t'attend dans une conversation, avec une notification.
      </p>

      {tasks.length === 0 && !editing && <p className="field-hint">Aucune tâche pour l'instant.</p>}

      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.enabled ? 'task-item' : 'task-item is-off'}>
            {confirmingId === task.id ? (
              <div className="settings-confirm" role="alertdialog" aria-label="Supprimer cette tâche ?">
                <span>Supprimer « {task.title} » ?</span>
                <button type="button" className="button" autoFocus onClick={() => setConfirmingId(null)}>
                  Annuler
                </button>
                <button type="button" className="button button-danger" onClick={() => void remove(task.id)}>
                  Supprimer
                </button>
              </div>
            ) : (
              <>
                <div className="task-head">
                  <label className="task-toggle" title={task.enabled ? 'Désactiver' : 'Activer'}>
                    <input type="checkbox" checked={task.enabled} onChange={() => void toggle(task)} />
                    <span className="task-title">{task.title}</span>
                  </label>
                  <div className="history-actions">
                    <button
                      type="button"
                      className="history-action history-action-danger"
                      aria-label={`Supprimer la tâche : ${task.title}`}
                      title="Supprimer"
                      onClick={() => setConfirmingId(task.id)}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
                <p className="task-meta">
                  {describeSchedule(task.schedule)}
                  {task.enabled && task.nextRunAt ? ` · prochaine : ${describeDate(new Date(task.nextRunAt))}` : ''}
                  {!task.enabled ? ' · désactivée' : ''}
                </p>
                {task.running ? (
                  <p className="task-status">{agent.name} y travaille…</p>
                ) : task.lastStatus === 'ok' && task.lastConversationId ? (
                  <p className="task-status">
                    Dernier résultat : {task.lastRunAt ? describeDate(new Date(task.lastRunAt)) : ''} ·{' '}
                    <button type="button" className="link-button" onClick={() => onOpenConversation(task.lastConversationId!)}>
                      Ouvrir
                    </button>
                  </p>
                ) : task.lastStatus === 'error' ? (
                  <p className="task-status form-error">Dernière exécution en échec : {task.lastMessage}</p>
                ) : null}
                <div className="task-actions">
                  <button type="button" className="button" disabled={task.running} onClick={() => window.toolbox.tasks.runNow(task.id)}>
                    Lancer maintenant
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      const { agentId, title, prompt, schedule, enabled } = task
                      setEditing({ id: task.id, input: { agentId, title, prompt, schedule, enabled } })
                    }}
                  >
                    Modifier
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <form
          className="task-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="field">
            <span className="field-label">Nom</span>
            <input
              className="input"
              maxLength={80}
              placeholder="Brief de la semaine"
              value={editing.input.title}
              onChange={(event) => update({ title: event.target.value })}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field-label">Consigne</span>
            <textarea
              className="input"
              rows={4}
              maxLength={4000}
              placeholder={`Ce que ${agent.name} doit faire à chaque fois`}
              value={editing.input.prompt}
              onChange={(event) => update({ prompt: event.target.value })}
            />
          </label>
          <div className="field">
            <span className="field-label">Jours</span>
            <div className="chips chips-wrap" role="group" aria-label="Jours">
              <button
                type="button"
                className="chip"
                aria-pressed={sameDays(editing.input.schedule.days, ALL_DAYS)}
                onClick={() => setDays([...ALL_DAYS])}
              >
                Tous les jours
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={sameDays(editing.input.schedule.days, WEEKDAYS)}
                onClick={() => setDays([...WEEKDAYS])}
              >
                Lun–ven
              </button>
              {DISPLAY_DAYS.map((day) => {
                const on = editing.input.schedule.days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() =>
                      setDays(on ? editing.input.schedule.days.filter((other) => other !== day) : [...editing.input.schedule.days, day])
                    }
                  >
                    {DAY_LABELS[day]}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="field field-inline">
            <span className="field-label">Heure</span>
            <input
              className="input input-small"
              type="time"
              value={editing.input.schedule.time}
              onChange={(event) =>
                setEditing((current) => current && { ...current, input: { ...current.input, schedule: { ...current.input.schedule, time: event.target.value } } })
              }
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="task-actions">
            <button type="button" className="button" onClick={() => {
              setEditing(null)
              setError(null)
            }}>
              Annuler
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={!editing.input.title.trim() || !editing.input.prompt.trim() || editing.input.schedule.days.length === 0}
            >
              {editing.id ? 'Enregistrer' : 'Programmer'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
