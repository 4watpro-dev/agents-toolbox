import { describe, expect, it } from 'vitest'
import { applyTeamEvent, newRun, runFromRecord } from './teamState'

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
        scheduled: true
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
