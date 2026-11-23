import { describe, expect, it } from 'vitest'
import { chiefCopyTurns, previousFromRuns, TeamInputSchema, teamReady, withoutAgent, type Team, type TeamConversation } from './teams'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'

const team = (overrides: Partial<Team> = {}): Team => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Com',
  chiefId: A,
  memberIds: [B, C],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...overrides
})

describe('TeamInputSchema', () => {
  it('exige un nom et entre 1 et 4 membres', () => {
    expect(TeamInputSchema.safeParse({ name: 'Com', chiefId: A, memberIds: [B] }).success).toBe(true)
    expect(TeamInputSchema.safeParse({ name: ' ', chiefId: A, memberIds: [B] }).success).toBe(false)
    expect(TeamInputSchema.safeParse({ name: 'Com', chiefId: A, memberIds: [] }).success).toBe(false)
  })
})

describe('withoutAgent et teamReady', () => {
  it('retire un membre supprimé et garde l’équipe prête', () => {
    const [updated] = withoutAgent([team()], C)
    expect(updated!.memberIds).toEqual([B])
    expect(teamReady(updated!, [A, B])).toBe(true)
  })

  it('laisse une équipe sans chef à compléter', () => {
    const [updated] = withoutAgent([team()], A)
    expect(updated!.chiefId).toBeNull()
    expect(teamReady(updated!, [B, C])).toBe(false)
  })

  it('ne touche pas aux équipes qui n’ont pas cet agent', () => {
    const untouched = team({ memberIds: [B] })
    expect(withoutAgent([untouched], C)[0]).toBe(untouched)
  })
})

describe('historique', () => {
  const conversation: TeamConversation = {
    id: '00000000-0000-4000-8000-000000000002',
    teamId: team().id,
    title: 'Jazz',
    runs: [
      {
        request: 'Un slogan',
        chiefName: 'DRpro',
        work: [{ agentId: B, name: 'Riff', task: 'Écris-le', text: 'Le jazz respire', problem: null }],
        answer: 'Slogan : Le jazz respire',
        at: '2026-11-01T10:00:00.000Z',
        scheduled: false
      }
    ],
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z'
  }

  it('donne le dernier échange pour une question de suite', () => {
    expect(previousFromRuns(conversation.runs)).toBe("La personne : Un slogan\n\nRéponse de l'équipe : Slogan : Le jazz respire")
    expect(previousFromRuns([])).toBeNull()
  })

  it('recopie la conversation chez le chef avec les contributions', () => {
    const turns = chiefCopyTurns(conversation, 'Com')
    expect(turns[0]).toEqual({ role: 'user', text: '[Équipe Com]\n\nUn slogan' })
    expect(turns[1]!.text).toContain('#### Riff\n\nLe jazz respire')
  })
})
