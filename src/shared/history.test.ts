import { describe, expect, it } from 'vitest'
import type { Conversation } from './conversation'
import { conversationMarkdown, exportFileName, fold, searchConversations } from './history'

const conversation = (id: string, overrides: Partial<Conversation> = {}): Conversation => ({
  id,
  agentId: 'agent-1',
  title: 'Campagne de Noël',
  messages: [
    { role: 'user', text: 'Prépare une séquence emailing pour Noël.' },
    { role: 'assistant', text: 'Voici une séquence en trois e-mails. Le premier e-mail annonce la vente privée.' }
  ],
  claudeSessionId: null,
  pinned: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...overrides
})

describe('fold', () => {
  it('ignore casse et accents sans décaler les positions', () => {
    expect(fold('Été À Noël')).toBe('ete a noel')
    expect(fold('a😀é')).toHaveLength('a😀é'.length)
  })
})

describe('searchConversations', () => {
  it('trouve un mot sans tenir compte des accents ni de la casse, avec un extrait', () => {
    const [hit] = searchConversations([conversation('c1')], 'SEQUENCE')
    expect(hit).toMatchObject({ conversationId: 'c1', count: 2 })
    expect(hit!.snippet.match).toBe('séquence')
    expect(hit!.snippet.before).toBe('Prépare une ')
  })

  it('se contente du titre quand les messages ne contiennent pas le texte', () => {
    const [hit] = searchConversations([conversation('c1')], 'campagne')
    expect(hit!.snippet.match).toBe('Campagne')
  })

  it('met les épinglées en tête, puis les plus récentes', () => {
    const hits = searchConversations(
      [
        conversation('ancienne', { updatedAt: '2026-10-01T00:00:00.000Z' }),
        conversation('recente', { updatedAt: '2026-11-05T00:00:00.000Z' }),
        conversation('epinglee', { updatedAt: '2026-09-01T00:00:00.000Z', pinned: true })
      ],
      'noël'
    )
    expect(hits.map((hit) => hit.conversationId)).toEqual(['epinglee', 'recente', 'ancienne'])
  })

  it('ne cherche rien sous deux caractères et ne trouve pas ce qui est absent', () => {
    expect(searchConversations([conversation('c1')], 'e')).toEqual([])
    expect(searchConversations([conversation('c1')], 'pâques')).toEqual([])
  })

  it('coupe un long message autour du mot trouvé', () => {
    const long = `${'a'.repeat(300)} trésor ${'b'.repeat(300)}`
    const [hit] = searchConversations([conversation('c1', { messages: [{ role: 'user', text: long }] })], 'tresor')
    expect(hit!.snippet.before.startsWith('…')).toBe(true)
    expect(hit!.snippet.after.endsWith('…')).toBe(true)
  })
})

describe('conversationMarkdown', () => {
  it('met en forme le titre, les auteurs et les pièces jointes', () => {
    const markdown = conversationMarkdown(
      conversation('c1', {
        messages: [
          { role: 'user', text: 'Regarde', attachments: [{ name: 'brief.pdf', kind: 'pdf' }] },
          { role: 'assistant', text: 'Vu.' }
        ]
      }),
      'Mailo'
    )
    expect(markdown).toContain('# Campagne de Noël')
    expect(markdown).toContain('*Conversation avec Mailo · ')
    expect(markdown).toContain('## Toi\n\n[Pièces jointes : brief.pdf]\nRegarde')
    expect(markdown).toContain('## Mailo\n\nVu.')
    expect(markdown.endsWith('Vu.\n')).toBe(true)
  })
})

describe('exportFileName', () => {
  it('donne un nom de fichier sûr', () => {
    expect(exportFileName('Campagne : Noël / 2026 ?')).toBe('Campagne-Noël-2026.md')
    expect(exportFileName('???')).toBe('conversation.md')
  })
})
