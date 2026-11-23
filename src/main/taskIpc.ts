import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC, type Result, type TaskView } from '../shared/ipc'
import { nextOccurrence, TaskInputSchema, type Task } from '../shared/schedule'
import { isTaskRunning, onTasksChanged, runTask, startScheduler } from './scheduler'
import { listAgents } from './store/agents'
import { listTasks, removeTask, saveTask } from './store/tasks'
import { sendTasksChanged } from './windows'

function toView(task: Task): TaskView {
  const next = task.enabled ? nextOccurrence(task.schedule, new Date()) : null
  return { ...task, nextRunAt: next?.toISOString() ?? null, running: isTaskRunning(task.id) }
}

export function registerTaskIpc(): void {
  ipcMain.handle(IPC.tasksList, (_event, agentId: unknown) => {
    const id = z.uuid().parse(agentId)
    return listTasks()
      .filter((task) => task.agentId === id)
      .map(toView)
  })
  ipcMain.handle(IPC.tasksSave, (_event, id: unknown, input: unknown): Result<TaskView> => {
    const parsed = TaskInputSchema.safeParse(input)
    if (!parsed.success) return { ok: false, message: 'Donne un nom, une consigne, au moins un jour et une heure.' }
    if (!listAgents().some((agent) => agent.id === parsed.data.agentId)) return { ok: false, message: 'Agent introuvable.' }
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
