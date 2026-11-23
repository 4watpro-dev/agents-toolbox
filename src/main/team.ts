import type { Agent } from '../shared/agent'
import type { ChatEvent } from '../shared/chat'
import type { TeamEvent } from '../shared/ipc'
import { memberPrompt, parsePlan, planPrompt, synthesisPrompt, type Contribution } from '../shared/team'
import { previousFromRuns, type MemberWork } from '../shared/teams'
import { stopMessage } from './ai/chat'
import { stopViaClaudeCode } from './ai/claudeCode'
import { listAgents } from './store/agents'
import { appendTeamRun, getTeam, getTeamConversation } from './store/teams'
import { cancelSession, runTurn } from './turns'

export interface TeamRequest {
  teamId: string
  /** Conversation de l'équipe : nouvelle, ou reprise pour une question de suite. */
  conversationId: string
  text: string
  /** Lancée par une tâche programmée : la conversation prend le nom de la tâche. */
  scheduledTitle?: string
}

export type TeamOutcome = { ok: true; answer: string } | { ok: false; message: string }

type Deliver = (event: TeamEvent) => void

/** Équipes en cours : l'étape active, pour pouvoir l'arrêter. */
const runs = new Map<string, { stopped: boolean; step: string | null }>()

export function isTeamRunning(conversationId: string): boolean {
  return runs.has(conversationId)
}

/** Un tour éphémère d'un agent, relayé au fil de l'eau. */
function step(
  run: { stopped: boolean; step: string | null },
  agent: Agent,
  text: string,
  onText: (piece: string) => void
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    const sessionId = `equipe-${crypto.randomUUID()}`
    run.step = sessionId
    let full = ''
    const deliver = (event: ChatEvent): void => {
      if (event.type === 'delta') {
        full += event.text
        onText(event.text)
      } else if (event.type === 'done' || event.type === 'stopped' || event.type === 'error') {
        run.step = null
        cancelSession(sessionId)
        if (event.type === 'done') resolve({ ok: true, text: full.trim() })
        else resolve({ ok: false, message: event.type === 'error' ? event.failure.message : 'Arrêté.' })
      }
    }
    const started = runTurn({ sessionId, agentId: agent.id, draft: agent, text, attachments: [], ephemeral: true, unattended: true }, deliver)
    if (!started) resolve({ ok: false, message: 'Une autre réponse est en cours.' })
  })
}

/**
 * Le chef répartit, les membres travaillent l'un après l'autre, le chef synthétise.
 * La demande, le travail de chacun et la réponse sont enregistrés dans l'historique de l'équipe.
 */
export async function runTeam(request: TeamRequest, deliver: Deliver): Promise<TeamOutcome> {
  const { conversationId, text } = request
  const fail = (message: string): TeamOutcome => {
    deliver({ conversationId, type: 'error', message })
    return { ok: false, message }
  }
  if (runs.has(conversationId)) return { ok: false, message: 'Cette équipe travaille déjà.' }

  const team = getTeam(request.teamId)
  const agents = listAgents()
  const chief = agents.find((agent) => agent.id === team?.chiefId)
  const members = agents.filter((agent) => team?.memberIds.includes(agent.id) && agent.id !== chief?.id)
  if (!team) return fail('Cette équipe n’existe plus.')
  if (!chief || members.length === 0) return fail('Il manque un chef ou des membres à cette équipe : modifie-la.')

  const run = { stopped: false, step: null as string | null }
  runs.set(conversationId, run)
  const stopped = (): TeamOutcome => {
    deliver({ conversationId, type: 'stopped' })
    return { ok: false, message: 'Travail d’équipe interrompu.' }
  }
  try {
    const previous = previousFromRuns(getTeamConversation(team.id, conversationId)?.runs ?? [])
    deliver({ conversationId, type: 'phase', phase: 'plan' })
    const roster = members.map((member) => ({ id: member.id, name: member.name, specialty: member.specialty, description: member.description }))
    const plan = await step(run, chief, planPrompt(text, roster, previous), () => undefined)
    if (run.stopped) return stopped()
    if (!plan.ok) return fail(plan.message)

    const assignments = parsePlan(plan.text, roster)
    deliver({ conversationId, type: 'plan', assignments })

    const contributions: Contribution[] = []
    const work: MemberWork[] = []
    for (const assignment of assignments) {
      const member = members.find((candidate) => candidate.id === assignment.agentId)!
      deliver({ conversationId, type: 'member-start', agentId: member.id })
      const result = await step(run, member, memberPrompt(text, chief.name, assignment.task, contributions), (piece) =>
        deliver({ conversationId, type: 'member-delta', agentId: member.id, text: piece })
      )
      if (run.stopped) return stopped()
      const output = result.ok ? result.text : ''
      contributions.push({ name: member.name, task: assignment.task, text: output })
      work.push({ agentId: member.id, name: member.name, task: assignment.task, text: output, problem: result.ok ? null : result.message })
      deliver({ conversationId, type: 'member-done', agentId: member.id, ...(result.ok ? {} : { problem: result.message }) })
    }

    deliver({ conversationId, type: 'phase', phase: 'synthesis' })
    // Sans membre utile, le chef répond seul à la demande.
    const finalPrompt = assignments.length > 0 ? synthesisPrompt(text, contributions) : text
    const answer = await step(run, chief, finalPrompt, (piece) => deliver({ conversationId, type: 'delta', text: piece }))
    if (run.stopped) return stopped()
    if (!answer.ok) return fail(answer.message)

    appendTeamRun(
      team.id,
      conversationId,
      { request: text, chiefName: chief.name, work, answer: answer.text, at: new Date().toISOString(), scheduled: Boolean(request.scheduledTitle) },
      request.scheduledTitle
    )
    deliver({ conversationId, type: 'done', answer: answer.text })
    return { ok: true, answer: answer.text }
  } finally {
    runs.delete(conversationId)
  }
}

export function stopTeam(conversationId: string): void {
  const run = runs.get(conversationId)
  if (!run) return
  run.stopped = true
  if (run.step) {
    stopViaClaudeCode(run.step)
    stopMessage(run.step)
  }
}
