import { describe, expect, it } from 'vitest'
import { cleanFacts, conversationTitle, MAX_FACT_LENGTH, MAX_FACTS, mergeFacts } from './conversation'

describe('conversationTitle', () => {
  it('garde un message court tel quel, sur une ligne', () => {
    expect(conversationTitle('  Salut\n  toi ')).toBe('Salut toi')
  })

  it('coupe un message long', () => {
    const title = conversationTitle('a'.repeat(200))
    expect(title).toHaveLength(60)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('mergeFacts', () => {
  it('ajoute les nouveaux faits', () => {
    expect(mergeFacts(['a'], ['b'])).toEqual({ facts: ['a', 'b'], added: ['b'] })
  })

  it('ignore les doublons, même avec une autre casse', () => {
    expect(mergeFacts(['Vit à Brest'], ['vit à brest ', 'b', 'B']).added).toEqual(['b'])
  })

  it('tronque un fait trop long', () => {
    expect(mergeFacts([], ['x'.repeat(500)]).added[0]).toHaveLength(MAX_FACT_LENGTH)
  })

  it('respecte le plafond', () => {
    const full = Array.from({ length: MAX_FACTS }, (_, i) => `fait ${i}`)
    expect(mergeFacts(full, ['encore']).added).toEqual([])
  })
})

describe('cleanFacts', () => {
  it('retire les vides et les doublons', () => {
    expect(cleanFacts(['a', '  ', 'A', 'b'])).toEqual(['a', 'b'])
  })
})
