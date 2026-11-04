import { describe, expect, it } from 'vitest'
import { activityLabel, AgentToolsSchema, describeToolUse, isValidDomain, parseDomains } from './tools'

describe('parseDomains', () => {
  it('ramène les adresses collées à leur domaine', () => {
    expect(parseDomains('https://help.brevo.com/hc/fr, *.Example.com\nbrevo.com ; brevo.com')).toEqual([
      'help.brevo.com',
      'example.com',
      'brevo.com'
    ])
  })

  it('conserve une entrée illisible pour pouvoir la signaler', () => {
    const domains = parseDomains('brevo.com localhost аmazon.com')
    expect(domains).toContain('localhost')
    expect(domains.filter((domain) => !isValidDomain(domain))).toEqual(['localhost', 'аmazon.com'])
  })
})

describe('AgentToolsSchema', () => {
  it('refuse un domaine non ASCII, un joker ou un chemin', () => {
    for (const domain of ['аmazon.com', '*.example.com', 'example.com/blog', 'localhost', 'https://a.com']) {
      expect(AgentToolsSchema.safeParse({ webSearch: true, webFetch: true, allowedDomains: [domain] }).success).toBe(false)
    }
  })
})

describe('describeToolUse', () => {
  it("reconnaît les outils de l'API et ceux de Claude Code", () => {
    expect(describeToolUse('web_search', { query: 'tarifs' })).toEqual({ kind: 'search', query: 'tarifs' })
    expect(describeToolUse('WebSearch', { query: 'tarifs' })).toEqual({ kind: 'search', query: 'tarifs' })
    expect(describeToolUse('web_fetch', { url: 'https://help.brevo.com/a' })).toEqual({ kind: 'fetch', host: 'help.brevo.com' })
    expect(describeToolUse('WebFetch', { url: 'https://help.brevo.com/a' })).toEqual({ kind: 'fetch', host: 'help.brevo.com' })
  })

  it('ignore un appel inconnu ou incomplet', () => {
    expect(describeToolUse('code_execution', { code: '1' })).toBeNull()
    expect(describeToolUse('web_fetch', { url: 'pas une adresse' })).toBeNull()
    expect(describeToolUse('web_search', null)).toBeNull()
  })
})

describe('activityLabel', () => {
  it("nomme l'agent et ce qu'il fait", () => {
    expect(activityLabel('Mailo', { kind: 'fetch', host: 'help.brevo.com' })).toBe('Mailo consulte help.brevo.com…')
    expect(activityLabel('Mailo', { kind: 'search', query: 'tarifs Brevo' })).toBe('Mailo cherche « tarifs Brevo »…')
  })

  it('raccourcit une longue recherche', () => {
    expect(activityLabel('Mailo', { kind: 'search', query: 'x'.repeat(200) }).length).toBeLessThan(90)
  })
})
