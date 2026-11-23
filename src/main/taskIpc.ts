import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC, type Result, type TaskView } from '../shared/ipc'
import { nextOccurrence, TaskInputSchema, type Task } from '../shared/schedule'
import { isTaskRunning, onTasksChanged, runTask, startScheduler } from './scheduler'
import { listAgents } from './store/agents'
import { listTasks, removeTask, saveTask } from './store/tasks'
import { getTeam } from './store/teams'

const OwnerSchema = z.union([z.object({ agentId: z.uuid() }), z.object({ teamId: z.uuid() })])
import { sendTasksChanged } from './windows'

function toView(task: Task): TaskView {
  const next = task.enabled ? nextOccurrence(task.schedule, new Date()) : null
  return { ...task, nextRunAt: next?.toISOString() ?? null, running: isTaskRunning(task.id) }
}

export function registerTaskIpc(): void {
  ipcMain.handle(IPC.tasksList, (_event, owner: unknown) => {
    const parsed = OwnerSchema.parse(owner)
    return listTasks()
      .filter((task) => ('agentId' in parsed ? task.agentId === parsed.agentId : task.teamId === parsed.teamId))
      .map(toView)
  })
  ipcMain.handle(IPC.tasksSave, (_event, id: unknown, input: unknown): Result<TaskView> => {
    const parsed = TaskInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false, message: 'Donne un nom, une consigne, au moins un jour et une heure.' }
    const { agentId, teamId } = parsed.data
    // Exactement un exécutant : un agent ou une équipe.
    if ((agentId === null) === (teamId === null)) return { ok: false, message: 'Une tâche appartient à un agent ou à une équipe.' }
    if (agentId && !listAgents().some((agent) => agent.id === agentId)) return { ok: false, message: 'Agent introuvable.' }
    if (teamId && !getTeam(teamId)) return { ok: false, message: 'Équipe introuvable.' }
    return { ok: true, value: toView(saveTask(id === null ? null : z.uuid().parse(id), parsed.data)) }
  })
  ipcMain.handle(IPC.tasksRemove, (_event, id: unknown) => {
    removeTask(z.uuid().parse(id))
  })
  ipcMain.on(IPC.tasksRunNow, (_event, id: unknown) => {
    const task = listTasks().find((candidate) => candidate.id === z.uuid().parse(id))
    if (task) void runTask(task)
  })
  onTasksChanged(sendTasksChanged)
  startScheduler()
}
