import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { classifyToolCall, connectorKey, ConnectorSchema, parseConnectorTool } from './connectors'

describe('classifyToolCall', () => {
  it('laisse passer les lectures évidentes', () => {
    for (const tool of ['get_stats', 'list_contacts', 'stats', 'contacts_list', 'getCampaignReport', 'search-contacts']) {
      expect(classifyToolCall(tool, {}), tool).toBe('read')
    }
  })

  it('demande confirmation pour toute écriture ou tout envoi', () => {
    for (const tool of ['create_contact', 'update_contact', 'delete_contact', 'send_campaign', 'sendEmail', 'import_contacts', 'contacts-remove']) {
      expect(classifyToolCall(tool, {}), tool).toBe('write')
    }
  })

  it("donne la priorité à l'écriture quand le nom contient les deux", () => {
    expect(classifyToolCall('get_and_send_report', {})).toBe('write')
    expect(classifyToolCall('list_then_delete', {})).toBe('write')
  })

  it('demande confirmation pour un nom inconnu', () => {
    for (const tool of ['manage_contacts', 'api_request', 'export_contacts', 'campaigns', 'unknown']) {
      expect(classifyToolCall(tool, {}), tool).toBe('write')
    }
  })

  it('ne se laisse pas tromper par un paramètre qui nomme une écriture', () => {
    expect(classifyToolCall('query_api', { method: 'DELETE' })).toBe('write')
    expect(classifyToolCall('get_resource', { action: 'send' })).toBe('write')
    expect(classifyToolCall('query_api', { method: 'GET' })).toBe('read')
    expect(classifyToolCall('search_contacts', { query: 'delete' })).toBe('read')
  })

  it('reste prudent face à une entrée absente', () => {
    expect(classifyToolCall('get_stats', null)).toBe('read')
    expect(classifyToolCall('', null)).toBe('write')
  })
})

describe('ConnectorSchema', () => {
  const parse = (url: string) => ConnectorSchema.safeParse({ id: randomUUID(), name: 'Brevo', url }).success

  it('accepte le https, et le http seulement en local', () => {
    expect(parse('https://mcp.brevo.com/v1/brevo/mcp')).toBe(true)
    expect(parse('http://127.0.0.1:8080/mcp')).toBe(true)
    expect(parse('http://mcp.brevo.com/mcp')).toBe(false)
  })

  it("refuse les autres protocoles et les secrets dans l'adresse", () => {
    expect(parse('file:///etc/passwd')).toBe(false)
    expect(parse('https://user:secret@mcp.brevo.com/')).toBe(false)
    expect(parse('https://mcp.brevo.com/${HOME}')).toBe(false)
    expect(parse('pas une adresse')).toBe(false)
  })
})

describe('parseConnectorTool', () => {
  it('sépare le connecteur et son outil', () => {
    expect(parseConnectorTool('mcp__brevo__send_campaign')).toEqual({ key: 'brevo', tool: 'send_campaign' })
    expect(parseConnectorTool('mcp__a-b__c__d')).toEqual({ key: 'a-b', tool: 'c__d' })
    expect(parseConnectorTool('WebSearch')).toBeNull()
  })
})

describe('connectorKey', () => {
  it('produit une clé sûre et sans doublon', () => {
    expect(connectorKey('Mon Brévo !', [])).toBe('mon-brevo')
    expect(connectorKey('Brevo', ['brevo'])).toBe('brevo-2')
    expect(connectorKey('Brevo', ['brevo', 'brevo-2'])).toBe('brevo-3')
    expect(connectorKey('日本語', [])).toBe('connecteur')
    expect(connectorKey('a__b', [])).toBe('a-b')
  })
})
