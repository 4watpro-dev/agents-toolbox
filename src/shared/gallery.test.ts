import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT, type Agent } from './agent'
import { filterAgents } from './gallery'

const agent = (name: string, patch: Partial<Agent> = {}): Agent => ({
  ...EMPTY_DRAFT,
  id: name,
  name,
  specialty: 'test',
  createdAt: '',
  updatedAt: '',
  ...patch
})

const names = (agents: Agent[]): string[] => agents.map((a) => a.name)
const all = { query: '', category: null }

describe('filterAgents', () => {
  it('épingle les favoris, puis trie par nom sans tenir compte des accents', () => {
    const agents = [agent('Zoé'), agent('Émile'), agent('Noa', { isFavorite: true }), agent('Basile')]
    expect(names(filterAgents(agents, all))).toEqual(['Noa', 'Basile', 'Émile', 'Zoé'])
  })

  it('filtre par catégorie', () => {
    const agents = [agent('A', { category: 'Code' }), agent('B', { category: 'Perso' })]
    expect(names(filterAgents(agents, { query: '', category: 'Code' }))).toEqual(['A'])
  })

  it('cherche sans tenir compte de la casse ni des accents', () => {
    const agents = [agent('A', { specialty: 'Relecture et écriture' }), agent('B')]
    expect(names(filterAgents(agents, { query: 'ECRITURE', category: null }))).toEqual(['A'])
  })

  it('exige tous les mots de la recherche', () => {
    const agents = [agent('A', { specialty: 'coach sportif' }), agent('B', { specialty: 'coach vocal' })]
    expect(names(filterAgents(agents, { query: 'coach vocal', category: null }))).toEqual(['B'])
  })

  it('ne modifie pas la liste reçue', () => {
    const agents = [agent('B'), agent('A')]
    filterAgents(agents, all)
    expect(names(agents)).toEqual(['B', 'A'])
  })
})
