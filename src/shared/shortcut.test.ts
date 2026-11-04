import { describe, expect, it } from 'vitest'
import { formatAccelerator, toAccelerator, type KeyPress } from './shortcut'

const press = (code: string, modifiers: Partial<KeyPress> = {}): KeyPress => ({
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers
})

describe('toAccelerator', () => {
  it('traduit le raccourci par défaut', () => {
    expect(toAccelerator(press('Space', { metaKey: true, shiftKey: true }))).toBe('Command+Shift+Space')
  })

  it('utilise la touche physique, pas le caractère produit par Option', () => {
    expect(toAccelerator(press('KeyA', { ctrlKey: true, altKey: true }))).toBe('Control+Alt+A')
  })

  it('accepte chiffres et flèches', () => {
    expect(toAccelerator(press('Digit5', { metaKey: true }))).toBe('Command+5')
    expect(toAccelerator(press('ArrowUp', { altKey: true }))).toBe('Alt+Up')
  })

  it('refuse une touche seule ou avec Maj seul', () => {
    expect(toAccelerator(press('KeyA'))).toBeNull()
    expect(toAccelerator(press('KeyA', { shiftKey: true }))).toBeNull()
  })

  it('accepte une touche de fonction seule', () => {
    expect(toAccelerator(press('F5'))).toBe('F5')
  })

  it('attend la touche finale quand seul un modificateur est pressé', () => {
    expect(toAccelerator(press('MetaLeft', { metaKey: true }))).toBeNull()
    expect(toAccelerator(press('ShiftLeft', { shiftKey: true }))).toBeNull()
  })
})

describe('formatAccelerator', () => {
  it('écrit le raccourci avec les symboles du Mac', () => {
    expect(formatAccelerator('Command+Shift+Space')).toBe('⌘ ⇧ Espace')
  })
})
