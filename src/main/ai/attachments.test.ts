import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) } }))

const { prepareAttachments, userContent } = await import('./attachments')

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

describe('prepareAttachments', () => {
  it('ne demande rien quand il n’y a rien', () => {
    expect(prepareAttachments(undefined)).toEqual({ ok: true, value: [] })
  })

  it('transforme un PDF en document et une image en image', () => {
    const result = prepareAttachments([
      { name: 'devis.pdf', data: bytes('%PDF-1.4 contenu') },
      { name: 'capture.png', data: PNG }
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[0]!.block).toMatchObject({ type: 'document', title: 'devis.pdf', source: { media_type: 'application/pdf' } })
    expect(result.value[1]!.block).toMatchObject({ type: 'image', source: { media_type: 'image/png' } })
    expect(result.value.map((attachment) => attachment.meta)).toEqual([
      { name: 'devis.pdf', kind: 'pdf' },
      { name: 'capture.png', kind: 'image' }
    ])
  })

  it('entoure un fichier texte d’une balise, sans que son nom puisse la fermer', () => {
    const result = prepareAttachments([{ name: 'a"><b.md', data: bytes('# Titre') }])
    expect(result.ok && result.value[0]!.block).toEqual({ type: 'text', text: '<fichier nom="a___b.md">\n# Titre\n</fichier>' })
  })

  it('refuse un fichier dont le contenu ne correspond pas à son extension', () => {
    expect(prepareAttachments([{ name: 'faux.png', data: bytes('pas une image') }])).toMatchObject({ ok: false })
    expect(prepareAttachments([{ name: 'faux.pdf', data: bytes('pas un pdf') }])).toMatchObject({ ok: false })
    expect(prepareAttachments([{ name: 'binaire.txt', data: new Uint8Array([104, 0, 105]) }])).toMatchObject({ ok: false })
  })

  it('refuse un type inconnu, trop de fichiers ou une forme invalide', () => {
    expect(prepareAttachments([{ name: 'a.zip', data: bytes('x') }])).toMatchObject({ ok: false })
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `${i}.txt`, data: bytes('x') }))
    expect(prepareAttachments(six)).toMatchObject({ ok: false })
    expect(prepareAttachments([{ name: 'a.txt', data: 'texte' }])).toMatchObject({ ok: false })
  })
})

describe('userContent', () => {
  it('place les pièces jointes avant la question', () => {
    const result = prepareAttachments([{ name: 'a.txt', data: bytes('x') }])
    if (!result.ok) throw new Error('inattendu')
    const content = userContent('Résume', result.value)
    expect(content.map((block) => block.type)).toEqual(['text', 'text'])
    expect(content.at(-1)).toEqual({ type: 'text', text: 'Résume' })
  })

  it('donne une question par défaut à un message sans texte', () => {
    expect(userContent('', []).at(-1)).toEqual({ type: 'text', text: 'Voici des pièces jointes.' })
  })
})
