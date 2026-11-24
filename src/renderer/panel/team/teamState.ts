import type { TeamEvent } from '../../../shared/ipc'
import type { Assignment } from '../../../shared/team'
import type { TeamRunRecord } from '../../../shared/teams'
import type { ToolActivity } from '../../../shared/tools'

export type MemberStatus = 'waiting' | 'working' | 'done' | 'error'

export interface TeamRun {
  id: number
  request: string
  phase: 'plan' | 'members' | 'synthesis'
  assignments: Assignment[]
  outputs: Record<string, { text: string; status: MemberStatus; problem?: string }>
  answer: string
  status: 'running' | 'done' | 'error' | 'stopped'
  error?: string
  /** Noms enregistrés, pour un membre supprimé depuis. */
  names?: Record<string, string>
  scheduled?: boolean
  /** Ce que fait chaque agent en ce moment (recherche, lecture). */
  activity?: Record<string, ToolActivity>
  /** Début de l'étape en cours (Date.now), pour afficher le temps écoulé. */
  stepStartedAt?: number
}

/** Demande déjà enregistrée, affichée comme une demande terminée. */
export function runFromRecord(record: TeamRunRecord, id: number): TeamRun {
  return {
    id,
    request: record.request,
    phase: 'synthesis',
    assignments: record.work.map((work) => ({ agentId: work.agentId, task: work.task })),
    outputs: Object.fromEntries(
      record.work.map((work) => [
        work.agentId,
        { text: work.text, status: work.problem ? ('error' as const) : ('done' as const), ...(work.problem ? { problem: work.problem } : {}) }
      ])
    ),
    answer: record.answer,
    status: record.status,
    ...(record.error ? { error: record.error } : {}),
    names: Object.fromEntries(record.work.map((work) => [work.agentId, work.name])),
    scheduled: record.scheduled
  }
}

export function newRun(id: number, request: string, now = Date.now()): TeamRun {
  return { id, request, phase: 'plan', assignments: [], outputs: {}, answer: '', status: 'running', stepStartedAt: now }
}

/** Applique un événement de l'équipe à la demande en cours. */
export function applyTeamEvent(run: TeamRun, event: TeamEvent, now = Date.now()): TeamRun {
  switch (event.type) {
    case 'activity':
      return { ...run, activity: { ...run.activity, [event.agentId]: event.activity } }
    case 'phase':
      return { ...run, phase: event.phase, stepStartedAt: now }
    case 'plan':
      return {
        ...run,
        phase: 'members',
        assignments: event.assignments,
        outputs: Object.fromEntries(event.assignments.map((assignment) => [assignment.agentId, { text: '', status: 'waiting' as const }]))
      }
    case 'member-start':
      return { ...run, stepStartedAt: now, outputs: { ...run.outputs, [event.agentId]: { text: '', status: 'working' } } }
    case 'member-delta': {
      const current = run.outputs[event.agentId] ?? { text: '', status: 'working' as const }
      return { ...run, outputs: { ...run.outputs, [event.agentId]: { ...current, text: current.text + event.text } } }
    }
    case 'member-done': {
      const current = run.outputs[event.agentId] ?? { text: '', status: 'working' as const }
      const { [event.agentId]: _finished, ...activity } = run.activity ?? {}
      return {
        ...run,
        activity,
        outputs: {
          ...run.outputs,
          [event.agentId]: { ...current, status: event.problem ? 'error' : 'done', ...(event.problem ? { problem: event.problem } : {}) }
        }
      }
    }
    case 'delta':
      return { ...run, answer: run.answer + event.text }
    case 'done':
      return { ...run, status: 'done' }
    case 'stopped':
      return { ...run, status: 'stopped' }
    case 'error':
      return { ...run, status: 'error', error: event.message }
  }
}


/** « 45 s » ou « 2 min 05 », pour le temps passé sur une étape. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')}`
}
