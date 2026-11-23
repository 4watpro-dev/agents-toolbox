import type { TeamEvent } from '../../../shared/ipc'
import type { Assignment } from '../../../shared/team'
import type { TeamRunRecord } from '../../../shared/teams'

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
    status: 'done',
    names: Object.fromEntries(record.work.map((work) => [work.agentId, work.name])),
    scheduled: record.scheduled
  }
}

export function newRun(id: number, request: string): TeamRun {
  return { id, request, phase: 'plan', assignments: [], outputs: {}, answer: '', status: 'running' }
}

/** Applique un événement de l'équipe à la demande en cours. */
export function applyTeamEvent(run: TeamRun, event: TeamEvent): TeamRun {
  switch (event.type) {
    case 'phase':
      return { ...run, phase: event.phase }
    case 'plan':
      return {
        ...run,
        phase: 'members',
        assignments: event.assignments,
        outputs: Object.fromEntries(event.assignments.map((assignment) => [assignment.agentId, { text: '', status: 'waiting' as const }]))
      }
    case 'member-start':
      return { ...run, outputs: { ...run.outputs, [event.agentId]: { text: '', status: 'working' } } }
    case 'member-delta': {
      const current = run.outputs[event.agentId] ?? { text: '', status: 'working' as const }
      return { ...run, outputs: { ...run.outputs, [event.agentId]: { ...current, text: current.text + event.text } } }
    }
    case 'member-done': {
      const current = run.outputs[event.agentId] ?? { text: '', status: 'working' as const }
      return {
        ...run,
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

