import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { TaskSchema, type Task, type TaskInput } from '../../shared/schedule'
import { readJson, writeJson } from './jsonFile'

const tasksPath = (): string => join(app.getPath('userData'), 'tasks.json')

let tasks: Task[] | null = null

function persist(next: Task[]): void {
  tasks = next
  writeJson(tasksPath(), next)
}

export function listTasks(): Task[] {
  tasks ??= readJson(tasksPath(), z.array(TaskSchema), [])
  return tasks
}

/** `id` nul : crée une tâche. Modifier l'horaire ne relance pas une occurrence déjà passée. */
export function saveTask(id: string | null, input: TaskInput): Task {
  const all = listTasks()
  if (id === null) {
    const task: Task = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      lastStatus: null,
      lastMessage: null,
      lastConversationId: null
    }
    persist([...all, task])
    return task
  }
  const existing = all.find((task) => task.id === id)
  if (!existing) throw new Error('Tâche introuvable')
  const updated: Task = { ...existing, ...input }
  persist(all.map((task) => (task.id === id ? updated : task)))
  return updated
}

export function updateTaskRun(id: string, run: Pick<Task, 'lastRunAt' | 'lastStatus' | 'lastMessage' | 'lastConversationId'>): void {
  persist(listTasks().map((task) => (task.id === id ? { ...task, ...run } : task)))
}

export function removeTask(id: string): void {
  persist(listTasks().filter((task) => task.id !== id))
}

/** Les tâches d'une équipe supprimée disparaissent avec elle. */
export function removeTeamTasks(teamId: string): void {
  persist(listTasks().filter((task) => task.teamId !== teamId))
}

/** Les tâches d'un agent supprimé disparaissent avec lui. */
export function removeAgentTasks(agentId: string): void {
  persist(listTasks().filter((task) => task.agentId !== agentId))
}
