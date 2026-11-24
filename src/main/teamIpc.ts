import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC, type Result, type TeamEvent } from '../shared/ipc'
import { chiefCopyTurns, TeamInputSchema, type Team } from '../shared/teams'
import { listAgents } from './store/agents'
import { appendTurns, setConversationTitle } from './store/conversations'
import { removeTeamTasks } from './store/tasks'
import {
  deleteTeamConversation,
  getTeam,
  getTeamConversation,
  listTeamConversations,
  listTeams,
  removeTeam,
  saveTeam
} from './store/teams'
import { runTeam, stopTeam } from './team'
import { notify, preview } from './scheduler'
import { isPanelOpen, sendTasksChanged, setWidgetBadge } from './windows'

const IdSchema = z.uuid()
const TextSchema = z.string().trim().min(1).max(20_000)

function saveTeamInput(id: unknown, input: unknown): Result<Team> {
  const parsed = TeamInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Donne un nom, un chef et 1 à 4 membres.' }
  const agentIds = listAgents().map((agent) => agent.id)
  const known = [parsed.data.chiefId, ...parsed.data.memberIds].every((agent) => agent === null || agentIds.includes(agent))
  if (!known || parsed.data.chiefId === null) return { ok: false, message: 'Choisis un chef et des membres parmi tes agents.' }
  if (parsed.data.memberIds.every((member) => member === parsed.data.chiefId)) return { ok: false, message: 'Le chef ne peut pas être son seul membre.' }
  return { ok: true, value: saveTeam(id === null ? null : IdSchema.parse(id), parsed.data) }
}

/** Recopie une conversation d'équipe chez le chef, pour qu'il continue seul. */
function continueWithChief(teamId: string, conversationId: string): Result<{ agentId: string; conversationId: string }> {
  const team = getTeam(teamId)
  const conversation = getTeamConversation(teamId, conversationId)
  const chief = listAgents().find((agent) => agent.id === team?.chiefId)
  if (!team || !conversation || !chief) return { ok: false, message: 'Impossible de retrouver cette conversation ou son chef.' }
  const copyId = randomUUID()
  appendTurns(chief.id, copyId, chiefCopyTurns(conversation, team.name), null)
  setConversationTitle(chief.id, copyId, `${team.name} · ${conversation.title}`)
  return { ok: true, value: { agentId: chief.id, conversationId: copyId } }
}

export function registerTeamIpc(): void {
  ipcMain.handle(IPC.teamsList, () => listTeams())
  ipcMain.handle(IPC.teamsSave, (_event, id: unknown, input: unknown) => saveTeamInput(id, input))
  ipcMain.handle(IPC.teamsRemove, (_event, id: unknown) => {
    const teamId = IdSchema.parse(id)
    removeTeam(teamId)
    removeTeamTasks(teamId)
    sendTasksChanged()
  })
  ipcMain.handle(IPC.teamConversationsList, (_event, teamId: unknown) => listTeamConversations(IdSchema.parse(teamId)))
  ipcMain.handle(IPC.teamConversationsGet, (_event, teamId: unknown, id: unknown) =>
    getTeamConversation(IdSchema.parse(teamId), IdSchema.parse(id))
  )
  ipcMain.handle(IPC.teamConversationsDelete, (_event, teamId: unknown, id: unknown) => {
    const conversationId = IdSchema.parse(id)
    stopTeam(conversationId, true)
    deleteTeamConversation(IdSchema.parse(teamId), conversationId)
  })
  ipcMain.handle(IPC.teamContinueWithChief, (_event, teamId: unknown, conversationId: unknown) =>
    continueWithChief(IdSchema.parse(teamId), IdSchema.parse(conversationId))
  )
  ipcMain.on(IPC.teamRun, (event, teamId: unknown, conversationId: unknown, text: unknown) => {
    const sender = event.sender
    const deliver = (teamEvent: TeamEvent): void => {
      if (!sender.isDestroyed()) sender.send(IPC.teamEvent, teamEvent)
    }
    const request = { teamId: IdSchema.parse(teamId), conversationId: IdSchema.parse(conversationId), text: TextSchema.parse(text) }
    void runTeam(request, deliver).then((outcome) => {
      // Panneau fermé pendant le travail : on prévient, comme pour une tâche programmée.
      if (isPanelOpen()) return
      const team = getTeam(request.teamId)
      if (!team || (!outcome.ok && outcome.message === 'Travail d’équipe interrompu.')) return
      const open = { teamId: team.id, conversationId: request.conversationId }
      if (outcome.ok) {
        setWidgetBadge(true)
        notify(`L'équipe ${team.name} a terminé`, preview(outcome.answer) || 'La réponse t’attend dans le panneau.', open)
      } else {
        notify(`L'équipe ${team.name} n'a pas pu finir`, outcome.message, open)
      }
    })
  })
  ipcMain.on(IPC.teamStop, (_event, conversationId: unknown) => stopTeam(IdSchema.parse(conversationId)))
}
