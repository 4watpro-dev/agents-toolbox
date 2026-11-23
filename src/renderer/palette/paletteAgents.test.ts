import { describe, expect, it } from 'vitest'
import type { Agent } from '../../shared/agent'
import { initialAgentId, neighborAgentId, paletteOrder } from './paletteAgents'

const agent = (id: string, name: string, isFavorite = false): Agent => ({ id, name, isFavorite }) as Agent

const agents = [agent('b', 'Basile'), agent('s', 'Sacha', true), agent('a', 'Alma')]

describe('paletteOrder', () => {
  it('met les favoris en tête, puis trie par nom', () => {
    expect(paletteOrder(agents).map((a) => a.id)).toEqual(['s', 'a', 'b'])
  })
})

describe('initialAgentId', () => {
  const ordered = paletteOrder(agents)

  it("garde l'agent en cours, puis le dernier utilisé, puis le premier", () => {
    expect(initialAgentId(ordered, 'b', 'a')).toBe('b')
    expect(initialAgentId(ordered, null, 'a')).toBe('a')
    expect(initialAgentId(ordered, 'supprimé', 'aussi-supprimé')).toBe('s')
    expect(initialAgentId([], null, null)).toBeNull()
  })
})

describe('neighborAgentId', () => {
  const ordered = paletteOrder(agents)

  it('passe au suivant ou au précédent, en boucle', () => {
    expect(neighborAgentId(ordered, 's', 1)).toBe('a')
    expect(neighborAgentId(ordered, 'b', 1)).toBe('s')
    expect(neighborAgentId(ordered, 's', -1)).toBe('b')
    expect(neighborAgentId([], null, 1)).toBeNull()
  })
})
