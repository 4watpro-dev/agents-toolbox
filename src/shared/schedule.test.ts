import { describe, expect, it } from 'vitest'
import { describeSchedule, isDue, nextOccurrence, previousOccurrence, type Task } from './schedule'

// Lundi 23 novembre 2026, heure locale.
const monday = (hours: number, minutes = 0): Date => new Date(2026, 10, 23, hours, minutes)
const weekdays = { days: [1, 2, 3, 4, 5], time: '09:00' }

const task = (overrides: Partial<Task> = {}): Task => ({
  id: '00000000-0000-4000-8000-000000000001',
  agentId: '00000000-0000-4000-8000-000000000002',
  title: 'Brief',
  prompt: 'Prépare le brief',
  schedule: weekdays,
  enabled: true,
  createdAt: new Date(2026, 10, 20, 12).toISOString(),
  lastRunAt: null,
  lastStatus: null,
  lastMessage: null,
  lastConversationId: null,
  ...overrides
})

describe('occurrences', () => {
  it("trouve l'occurrence passée et la prochaine", () => {
    expect(previousOccurrence(weekdays, monday(10))).toEqual(monday(9))
    expect(nextOccurrence(weekdays, monday(10))).toEqual(new Date(2026, 10, 24, 9))
  })

  it('saute le week-end', () => {
    // Avant 9 h le lundi : la précédente est le vendredi, la prochaine ce matin.
    expect(previousOccurrence(weekdays, monday(8))).toEqual(new Date(2026, 10, 20, 9))
    expect(nextOccurrence(weekdays, monday(8))).toEqual(monday(9))
  })
})

describe('isDue', () => {
  it("n'est pas due avant l'heure, l'est juste après", () => {
    const fresh = task({ createdAt: monday(7).toISOString() })
    expect(isDue(fresh, monday(8, 59))).toBe(false)
    expect(isDue(fresh, monday(9))).toBe(true)
  })

  it("ne repasse pas une fois exécutée, et ne rattrape qu'une fois", () => {
    expect(isDue(task({ lastRunAt: monday(9, 1).toISOString() }), monday(18))).toBe(false)
    // Créée vendredi après 9 h, Mac éteint lundi matin : exécution due lundi midi.
    expect(isDue(task(), monday(12))).toBe(true)
  })

  it("ne s'exécute pas désactivée, ni pour une occurrence antérieure à sa création", () => {
    expect(isDue(task({ enabled: false }), monday(12))).toBe(false)
    expect(isDue(task({ createdAt: monday(10).toISOString() }), monday(12))).toBe(false)
  })
})

describe('describeSchedule', () => {
  it('nomme les rythmes courants', () => {
    expect(describeSchedule({ days: [0, 1, 2, 3, 4, 5, 6], time: '08:30' })).toBe('Tous les jours à 08 h 30')
    expect(describeSchedule(weekdays)).toBe('Du lundi au vendredi à 09 h 00')
    expect(describeSchedule({ days: [5, 1, 0], time: '18:00' })).toBe('Lun, Ven, Dim à 18 h 00')
  })
})
