import { describe, expect, it } from 'vitest'
import { applyTeamEvent, formatElapsed, newRun, runFromRecord, teamSteps } from './teamState'

const id = 'c'

describe('applyTeamEvent', () => {
  it('suit la répartition, le travail des membres et la synthèse', () => {
    let run = newRun(1, 'Une bio')
    run = applyTeamEvent(run, { conversationId: id, type: 'plan', assignments: [{ agentId: 'p', task: 'rédige' }] })
    expect(run.outputs['p']).toEqual({ text: '', status: 'waiting' })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-start', agentId: 'p' })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-delta', agentId: 'p', text: 'Bon' })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-delta', agentId: 'p', text: 'jour' })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-done', agentId: 'p' })
    expect(run.outputs['p']).toEqual({ text: 'Bonjour', status: 'done' })
    run = applyTeamEvent(run, { conversationId: id, type: 'phase', phase: 'synthesis' })
    run = applyTeamEvent(run, { conversationId: id, type: 'delta', text: 'Final' })
    run = applyTeamEvent(run, { conversationId: id, type: 'done', answer: 'Final' })
    expect(run).toMatchObject({ phase: 'synthesis', answer: 'Final', status: 'done' })
  })

  it("note l'échec d'un membre sans arrêter l'équipe", () => {
    const run = applyTeamEvent(newRun(1, 'x'), { conversationId: id, type: 'member-done', agentId: 'p', problem: 'Limite atteinte' })
    expect(run.outputs['p']).toMatchObject({ status: 'error', problem: 'Limite atteinte' })
    expect(run.status).toBe('running')
  })
})

describe('runFromRecord', () => {
  it('rouvre une demande enregistrée, avec le travail et les échecs de chacun', () => {
    const run = runFromRecord(
      {
        request: 'Un slogan',
        chiefName: 'DRpro',
        work: [
          { agentId: 'r', name: 'Riff', task: 'Écris', text: 'Jazz', problem: null },
          { agentId: 'p', name: 'Plume', task: 'Relis', text: '', problem: 'Limite atteinte' }
        ],
        answer: 'Final',
        at: '2026-11-01T10:00:00.000Z',
        scheduled: true,
        status: 'done',
        error: null
      },
      1
    )
    expect(run.status).toBe('done')
    expect(run.outputs['r']).toEqual({ text: 'Jazz', status: 'done' })
    expect(run.outputs['p']).toMatchObject({ status: 'error', problem: 'Limite atteinte' })
    expect(run.names).toEqual({ r: 'Riff', p: 'Plume' })
    expect(run.scheduled).toBe(true)
  })
})

describe('signes de vie', () => {
  it("note l'activité d'un agent et l'oublie quand il a fini", () => {
    let run = applyTeamEvent(newRun(1, 'x', 0), { conversationId: id, type: 'member-start', agentId: 'p' }, 5000)
    expect(run.stepStartedAt).toBe(5000)
    run = applyTeamEvent(run, { conversationId: id, type: 'activity', agentId: 'p', activity: { kind: 'search', query: 'fail2ban' } })
    expect(run.activity?.['p']).toEqual({ kind: 'search', query: 'fail2ban' })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-done', agentId: 'p' })
    expect(run.activity?.['p']).toBeUndefined()
  })

  it('affiche le temps écoulé simplement', () => {
    expect(formatElapsed(45_000)).toBe('45 s')
    expect(formatElapsed(125_000)).toBe('2 min 05')
  })

  it('rouvre une demande échouée avec son erreur', () => {
    const run = runFromRecord(
      { request: 'x', chiefName: 'Vigie', work: [], answer: '', at: '2026-11-24T10:00:00.000Z', scheduled: false, status: 'error', error: 'Limite atteinte' },
      1
    )
    expect(run).toMatchObject({ status: 'error', error: 'Limite atteinte' })
  })
})

describe('teamSteps', () => {
  const name = (agentId: string): string => ({ p: 'Plume', r: 'Riff' })[agentId] ?? '?'

  it('avant la répartition : la répartition en cours, le reste à venir', () => {
    const steps = teamSteps(newRun(1, 'x'), 'Vigie', name)
    expect(steps.map((step) => step.state)).toEqual(['current', 'pending', 'pending'])
    expect(steps[0]!.label).toBe('Vigie répartit le travail')
  })

  it('suit les membres un par un, puis la réponse', () => {
    let run = applyTeamEvent(newRun(1, 'x'), { conversationId: id, type: 'plan', assignments: [{ agentId: 'p', task: 'a' }, { agentId: 'r', task: 'b' }] })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-start', agentId: 'p' })
    expect(teamSteps(run, 'Vigie', name).map((step) => step.state)).toEqual(['done', 'current', 'pending', 'pending'])
    run = applyTeamEvent(run, { conversationId: id, type: 'member-done', agentId: 'p' })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-start', agentId: 'r' })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-done', agentId: 'r', problem: 'Limite' })
    run = applyTeamEvent(run, { conversationId: id, type: 'phase', phase: 'synthesis' })
    const steps = teamSteps(run, 'Vigie', name)
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'failed', 'current'])
    expect(steps[2]!.label).toBe('Riff travaille')
    run = applyTeamEvent(run, { conversationId: id, type: 'done', answer: 'ok' })
    expect(teamSteps(run, 'Vigie', name).at(-1)!.state).toBe('done')
  })

  it("marque l'étape interrompue", () => {
    let run = applyTeamEvent(newRun(1, 'x'), { conversationId: id, type: 'plan', assignments: [{ agentId: 'p', task: 'a' }] })
    run = applyTeamEvent(run, { conversationId: id, type: 'member-start', agentId: 'p' })
    run = applyTeamEvent(run, { conversationId: id, type: 'stopped' })
    expect(teamSteps(run, 'Vigie', name).map((step) => step.state)).toEqual(['done', 'failed', 'pending'])
  })
})
