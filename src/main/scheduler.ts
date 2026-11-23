import { randomUUID } from 'node:crypto'
import { Notification, powerMonitor } from 'electron'
import { describeDate, isDue, type Task } from '../shared/schedule'
import { listAgents } from './store/agents'
import { setConversationTitle } from './store/conversations'
import { listTasks, updateTaskRun } from './store/tasks'
import { collectReply, runTurn } from './turns'
import { getTeam } from './store/teams'
import { runTeam } from './team'
import { openConversationInPanel, openTeamConversationInPanel, setWidgetBadge } from './windows'

const CHECK_INTERVAL_MS = 30_000
/** Laisse l'app finir de démarrer avant de rattraper les tâches manquées. */
const STARTUP_DELAY_MS = 8_000
const PREVIEW_LENGTH = 140

const running = new Set<string>()
let onChange: () => void = () => undefined

/** Prévient l'interface qu'une tâche a commencé ou fini, pour mettre à jour son état. */
export function onTasksChanged(listener: () => void): void {
  onChange = listener
}

function notify(
  title: string,
  body: string,
  open?: { agentId: string; conversationId: string } | { teamId: string; conversationId: string }
): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({ title, body, silent: false })
  if (open) {
    notification.on('click', () =>
      'agentId' in open ? openConversationInPanel(open.agentId, open.conversationId) : openTeamConversationInPanel(open.teamId, open.conversationId)
    )
  }
  notification.show()
}

function preview(text: string): string {
  const flat = text.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat
}

/** Tâche d'équipe : l'équipe travaille dans une nouvelle conversation de son historique. */
async function runTeamTask(task: Task, teamId: string): Promise<void> {
  const team = getTeam(teamId)
  const startedAt = new Date()
  if (!team) {
    updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: 'error', lastMessage: "L'équipe de cette tâche n'existe plus.", lastConversationId: null })
    onChange()
    return
  }
  running.add(task.id)
  const conversationId = randomUUID()
  updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: null, lastMessage: null, lastConversationId: conversationId })
  onChange()
  const text = `[Tâche programmée « ${task.title} », ${describeDate(startedAt)}]\n\n${task.prompt}`
  const outcome = await runTeam({ teamId, conversationId, text, scheduledTitle: task.title }, () => undefined)
  running.delete(task.id)
  if (outcome.ok) {
    updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: 'ok', lastMessage: null, lastConversationId: conversationId })
    setWidgetBadge(true)
    notify(`L'équipe ${team.name} a terminé « ${task.title} »`, preview(outcome.answer) || 'Le résultat t’attend dans le panneau.', { teamId, conversationId })
  } else {
    updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: 'error', lastMessage: outcome.message, lastConversationId: null })
    notify(`La tâche « ${task.title} » a échoué`, outcome.message)
  }
  onChange()
}

/** Exécute une tâche dans une nouvelle conversation, sans fenêtre ouverte. */
export async function runTask(task: Task): Promise<void> {
  if (running.has(task.id)) return
  if (task.teamId) return runTeamTask(task, task.teamId)
  const agent = task.agentId ? listAgents().find((candidate) => candidate.id === task.agentId) : undefined
  const startedAt = new Date()
  if (!agent) {
    updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: 'error', lastMessage: "L'agent de cette tâche n'existe plus.", lastConversationId: null })
    onChange()
    return
  }

  running.add(task.id)
  const conversationId = randomUUID()
  // Marquée tout de suite : la vérification suivante ne la relance pas pendant qu'elle tourne.
  updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: null, lastMessage: null, lastConversationId: conversationId })
  onChange()

  const text = `[Tâche programmée « ${task.title} », ${describeDate(startedAt)}]\n\n${task.prompt}`
  const reply = collectReply()
  const started = runTurn({ sessionId: conversationId, agentId: agent.id, draft: agent, text, attachments: [], unattended: true }, reply.deliver)
  const outcome = started ? await reply.result : { ok: false, text: '', message: 'Une autre réponse est en cours.' }
  running.delete(task.id)

  if (outcome.ok) {
    setConversationTitle(agent.id, conversationId, task.title)
    updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: 'ok', lastMessage: null, lastConversationId: conversationId })
    setWidgetBadge(true)
    notify(`${agent.name} a terminé « ${task.title} »`, preview(outcome.text) || 'Le résultat t’attend dans le panneau.', { agentId: agent.id, conversationId })
  } else {
    updateTaskRun(task.id, { lastRunAt: startedAt.toISOString(), lastStatus: 'error', lastMessage: outcome.message, lastConversationId: null })
    notify(`La tâche « ${task.title} » a échoué`, outcome.message)
  }
  onChange()
}

function checkDueTasks(): void {
  const now = new Date()
  for (const task of listTasks()) {
    if (isDue(task, now)) void runTask(task)
  }
}

export function isTaskRunning(id: string): boolean {
  return running.has(id)
}

/** Vérifie régulièrement les tâches dues, et rattrape celles manquées pendant une veille. */
export function startScheduler(): void {
  setTimeout(checkDueTasks, STARTUP_DELAY_MS)
  setInterval(checkDueTasks, CHECK_INTERVAL_MS)
  powerMonitor.on('resume', () => setTimeout(checkDueTasks, STARTUP_DELAY_MS))
}
