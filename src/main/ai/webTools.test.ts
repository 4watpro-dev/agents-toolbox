import { describe, expect, it } from 'vitest'
import { createServerToolTracker, sourcesFooter, webTools } from './webTools'

type Event = Parameters<ReturnType<typeof createServerToolTracker>['push']>[0]
const event = (value: unknown): Event => value as Event

describe('webTools', () => {
  it("n'envoie que les outils activés", () => {
    expect(webTools({ webSearch: false, webFetch: false, allowedDomains: [] })).toEqual([])
    expect(webTools({ webSearch: true, webFetch: false, allowedDomains: [] }).map((tool) => tool.type)).toEqual(['web_search_20250305'])
    expect(webTools({ webSearch: false, webFetch: true, allowedDomains: [] }).map((tool) => tool.type)).toEqual(['web_fetch_20250910'])
  })

  it('applique la même liste de domaines aux deux outils', () => {
    for (const tool of webTools({ webSearch: true, webFetch: true, allowedDomains: ['brevo.com'] })) {
      expect(tool).toMatchObject({ allowed_domains: ['brevo.com'] })
    }
  })

  it("n'envoie pas de liste vide, que l'API lirait comme un filtre", () => {
    for (const tool of webTools({ webSearch: true, webFetch: true, allowedDomains: [] })) {
      expect(tool).not.toHaveProperty('allowed_domains')
    }
  })
})

describe('createServerToolTracker', () => {
  it("signale l'appel une fois son entrée complète", () => {
    const tracker = createServerToolTracker()
    expect(tracker.push(event({ type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 'a', name: 'web_search' } }))).toBeNull()
    expect(tracker.push(event({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"query":"ta' } }))).toBeNull()
    tracker.push(event({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: 'rifs"}' } }))
    expect(tracker.push(event({ type: 'content_block_stop', index: 1 }))).toEqual({ kind: 'search', query: 'tarifs' })
  })

  it('ignore les blocs de texte', () => {
    const tracker = createServerToolTracker()
    tracker.push(event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }))
    expect(tracker.push(event({ type: 'content_block_stop', index: 0 }))).toBeNull()
  })

  it('collecte les citations et les pages lues, sans doublon', () => {
    const tracker = createServerToolTracker()
    const citation = { type: 'web_search_result_location', url: 'https://a.com/', title: 'A' }
    tracker.push(event({ type: 'content_block_delta', index: 2, delta: { type: 'citations_delta', citation } }))
    tracker.push(event({ type: 'content_block_delta', index: 3, delta: { type: 'citations_delta', citation } }))
    tracker.push(
      event({
        type: 'content_block_start',
        index: 4,
        content_block: { type: 'web_fetch_tool_result', content: { type: 'web_fetch_result', url: 'https://b.com/', content: { title: 'B' } } }
      })
    )
    expect(tracker.sources()).toEqual([
      { url: 'https://a.com/', title: 'A' },
      { url: 'https://b.com/', title: 'B' }
    ])
  })
})

describe('sourcesFooter', () => {
  it('liste les sources absentes de la réponse', () => {
    const sources = [
      { url: 'https://a.com/', title: 'A [1]' },
      { url: 'https://b.com/', title: 'B' }
    ]
    expect(sourcesFooter(sources, 'Voir https://b.com/')).toBe('\n\nSources :\n- [A 1](https://a.com/)')
  })

  it('ne dit rien sans source à ajouter', () => {
    expect(sourcesFooter([], 'texte')).toBe('')
    expect(sourcesFooter([{ url: 'https://a.com/', title: 'A' }], 'https://a.com/')).toBe('')
  })
})
