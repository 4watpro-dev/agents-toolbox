import { describe, expect, it } from 'vitest'
import { toHistoryContent } from './history'

const types = (blocks: { type: string }[]): string[] => blocks.map((block) => block.type)
const block = (type: string): never => ({ type }) as never

describe('toHistoryContent', () => {
  it('garde tous les blocs sans repli, réflexion comprise', () => {
    const content = [block('thinking'), block('text')]
    expect(types(toHistoryContent(content))).toEqual(['thinking', 'text'])
  })

  it('retire la réflexion antérieure au repli et garde le texte', () => {
    const content = [block('thinking'), block('text'), block('fallback'), block('thinking'), block('text')]
    expect(types(toHistoryContent(content))).toEqual(['text', 'thinking', 'text'])
  })

  it('se réfère au dernier repli', () => {
    const content = [block('thinking'), block('fallback'), block('redacted_thinking'), block('fallback'), block('text')]
    expect(types(toHistoryContent(content))).toEqual(['text'])
  })
})
