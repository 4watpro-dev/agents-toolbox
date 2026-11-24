import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex, parseHex } from './colorMath'

describe('conversions', () => {
  it('fait l’aller-retour sans perdre la couleur', () => {
    for (const hex of ['#5be370', '#c8f031', '#a98bff', '#ffffff', '#000000', '#ff0000', '#20242c']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
  })

  it('donne les valeurs attendues pour les couleurs franches', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00')
    expect(hsvToHex({ h: 240, s: 1, v: 0.5 })).toBe('#000080')
  })
})

describe('parseHex', () => {
  it('accepte les écritures courantes', () => {
    expect(parseHex('#A1B2C3')).toBe('#a1b2c3')
    expect(parseHex(' a1b2c3 ')).toBe('#a1b2c3')
    expect(parseHex('#abc')).toBe('#aabbcc')
  })

  it('refuse le reste', () => {
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('vert')).toBeNull()
  })
})
