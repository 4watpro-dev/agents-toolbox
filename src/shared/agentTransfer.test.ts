import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT, type Agent } from './agent'
import { parseAgentsFile, serializeAgents, uniqueName } from './agentTransfer'

const agent = (patch: Partial<Agent> = {}): Agent => ({
  ...EMPTY_DRAFT,
  id: 'identifiant',
  name: 'Noa',
  specialty: 'organisation',
  isFavorite: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-02',
  ...patch
})

describe('serializeAgents', () => {
  it('retire les identifiants et les dates', () => {
    const content = serializeAgents([agent()])
    expect(content).not.toContain('identifiant')
    expect(content).not.toContain('2026-01-01')
  })

  it("ne contient que les champs de la fiche", () => {
    const [exported] = JSON.parse(serializeAgents([agent()])).agents
    expect(Object.keys(exported).sort()).toEqual(Object.keys(EMPTY_DRAFT).sort())
  })
})

describe('parseAgentsFile', () => {
  it('relit un export complet', () => {
    const parsed = parseAgentsFile(serializeAgents([agent(), agent({ name: 'Basile' })]))
    expect(parsed?.drafts.map((draft) => draft.name)).toEqual(['Noa', 'Basile'])
    expect(parsed?.skipped).toBe(0)
  })

  it('conserve le prompt manuel', () => {
    const parsed = parseAgentsFile(serializeAgents([agent({ systemPromptOverride: 'Tu es un pirate.' })]))
    expect(parsed?.drafts[0].systemPromptOverride).toBe('Tu es un pirate.')
  })

  it('ne reprend pas le statut de favori', () => {
    expect(parseAgentsFile(serializeAgents([agent()]))?.drafts[0].isFavorite).toBe(false)
  })

  it('ignore une fiche invalide sans perdre les autres', () => {
    const file = JSON.parse(serializeAgents([agent()]))
    file.agents.push({ ...file.agents[0], model: 'modele-inconnu' }, { name: 'incomplet' })
    const parsed = parseAgentsFile(JSON.stringify(file))
    expect(parsed?.drafts).toHaveLength(1)
    expect(parsed?.skipped).toBe(2)
  })

  it.each(['pas du json', '{}', '[]', '{"format":"autre","version":1,"agents":[]}'])('refuse %s', (content) => {
    expect(parseAgentsFile(content)).toBeNull()
  })

  it("refuse un fichier d'une version plus récente", () => {
    const file = JSON.parse(serializeAgents([agent()]))
    file.version = 99
    expect(parseAgentsFile(JSON.stringify(file))).toBeNull()
  })

  it('ne garde aucun champ inattendu', () => {
    const file = JSON.parse(serializeAgents([agent()]))
    file.agents[0].champPiege = 'x'
    expect(parseAgentsFile(JSON.stringify(file))?.drafts[0]).not.toHaveProperty('champPiege')
  })
})

describe('uniqueName', () => {
  it('garde un nom libre', () => {
    expect(uniqueName('Noa', ['Basile'])).toBe('Noa')
  })

  it('numérote un nom déjà pris, sans tenir compte de la casse', () => {
    expect(uniqueName('noa', ['Noa'])).toBe('noa (2)')
    expect(uniqueName('Noa', ['Noa', 'Noa (2)'])).toBe('Noa (3)')
  })

  it('reste dans la longueur maximale', () => {
    const long = 'x'.repeat(40)
    expect(uniqueName(long, [long])).toHaveLength(40)
  })
})
