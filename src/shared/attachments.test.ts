import { describe, expect, it } from 'vitest'
import { attachmentKind, attachmentProblem, attachmentsNote, textWithAttachments } from './attachments'

describe('attachmentKind', () => {
  it('reconnaît les images, les PDF et le texte, sans tenir compte de la casse', () => {
    expect(attachmentKind('Capture.PNG')).toBe('image')
    expect(attachmentKind('photo.jpeg')).toBe('image')
    expect(attachmentKind('devis.pdf')).toBe('pdf')
    expect(attachmentKind('notes.md')).toBe('text')
    expect(attachmentKind('script.ts')).toBe('text')
  })

  it('refuse le reste, et les fichiers sans extension', () => {
    expect(attachmentKind('archive.zip')).toBeNull()
    expect(attachmentKind('rapport.docx')).toBeNull()
    expect(attachmentKind('Makefile')).toBeNull()
    expect(attachmentKind('.bashrc')).toBeNull()
  })
})

describe('attachmentProblem', () => {
  it('accepte un fichier valide', () => {
    expect(attachmentProblem('a.png', 1000)).toBeNull()
  })

  it('explique un refus', () => {
    expect(attachmentProblem('a.zip', 10)).toMatch(/non pris en charge/)
    expect(attachmentProblem('a.txt', 0)).toMatch(/vide/)
    expect(attachmentProblem('a.txt', 600 * 1024)).toMatch(/500 Ko maximum/)
    expect(attachmentProblem('a.pdf', 30 * 1024 * 1024)).toMatch(/20 Mo maximum/)
  })
})

describe('textWithAttachments', () => {
  const files = [
    { name: 'a.png', kind: 'image' as const },
    { name: 'b.pdf', kind: 'pdf' as const }
  ]

  it('mentionne les pièces jointes avant le texte', () => {
    expect(textWithAttachments('Regarde', files)).toBe('[Pièces jointes : a.png, b.pdf]\nRegarde')
  })

  it('se contente de la mention sans texte, et du texte sans pièce jointe', () => {
    expect(textWithAttachments('', files)).toBe('[Pièces jointes : a.png, b.pdf]')
    expect(textWithAttachments('Salut', undefined)).toBe('Salut')
    expect(attachmentsNote([])).toBe('')
  })
})
