import { z } from 'zod'

/** Jours de la semaine, numérotés comme `Date.getDay()` : 0 = dimanche. */
export const WEEKDAYS = [1, 2, 3, 4, 5] as const
export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const
/** Ordre d'affichage : la semaine commence le lundi. */
export const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0] as const

export const ScheduleSchema = z.object({
  /** Jours d'exécution (0 = dimanche). Les sept : tous les jours. */
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  /** Heure locale « HH:MM ». */
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
})

export type Schedule = z.infer<typeof ScheduleSchema>

export const TaskInputSchema = z.object({
  agentId: z.uuid(),
  title: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(4000),
  schedule: ScheduleSchema,
  enabled: z.boolean()
})

export const TaskSchema = TaskInputSchema.extend({
  id: z.uuid(),
  createdAt: z.string(),
  /** Dernière exécution, réussie ou non. */
  lastRunAt: z.string().nullable().default(null),
  lastStatus: z.enum(['ok', 'error']).nullable().default(null),
  lastMessage: z.string().nullable().default(null),
  /** Conversation produite par la dernière exécution. */
  lastConversationId: z.string().nullable().default(null)
})

export type TaskInput = z.infer<typeof TaskInputSchema>
export type Task = z.infer<typeof TaskSchema>

function atTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date(day)
  date.setHours(hours!, minutes!, 0, 0)
  return date
}

const MAX_DAYS_SCANNED = 8

/** Dernière occurrence prévue au plus tard à `now`, sur les huit derniers jours. */
export function previousOccurrence(schedule: Schedule, now: Date): Date | null {
  for (let offset = 0; offset < MAX_DAYS_SCANNED; offset++) {
    const day = new Date(now)
    day.setDate(now.getDate() - offset)
    if (!schedule.days.includes(day.getDay())) continue
    const occurrence = atTime(day, schedule.time)
    if (occurrence <= now) return occurrence
  }
  return null
}

/** Prochaine occurrence strictement après `now`. */
export function nextOccurrence(schedule: Schedule, now: Date): Date | null {
  for (let offset = 0; offset < MAX_DAYS_SCANNED; offset++) {
    const day = new Date(now)
    day.setDate(now.getDate() + offset)
    if (!schedule.days.includes(day.getDay())) continue
    const occurrence = atTime(day, schedule.time)
    if (occurrence > now) return occurrence
  }
  return null
}

/**
 * Une tâche est due si une occurrence est passée depuis sa dernière exécution
 * (ou depuis sa création). Plusieurs occurrences manquées ne donnent qu'une exécution.
 */
export function isDue(task: Task, now: Date): boolean {
  if (!task.enabled) return false
  const occurrence = previousOccurrence(task.schedule, now)
  if (!occurrence) return false
  const reference = new Date(task.lastRunAt ?? task.createdAt)
  return occurrence > reference
}

const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** « Tous les jours », « Du lundi au vendredi » ou « Lun, Mer, Ven », suivi de l'heure. */
export function describeSchedule(schedule: Schedule): string {
  const days = [...new Set(schedule.days)].sort()
  const time = schedule.time.replace(':', ' h ')
  if (days.length === 7) return `Tous les jours à ${time}`
  if (days.length === 5 && WEEKDAYS.every((day) => days.includes(day))) return `Du lundi au vendredi à ${time}`
  const ordered = DISPLAY_DAYS.filter((day) => days.includes(day)).map((day) => DAY_LABELS[day])
  return `${ordered.join(', ')} à ${time}`
}

/** « lundi 24 novembre à 09:00 », pour dire quand la tâche passera. */
export function describeDate(date: Date): string {
  return `${DAY_FORMAT.format(date)} à ${TIME_FORMAT.format(date)}`
}
