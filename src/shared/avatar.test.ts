import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR, faceColor, glassPalette, luminance, migrateLegacyAvatar, mixColor, shiftHue } from './avatar'

describe('luminance', () => {
  it('donne 0 pour le noir et 1 pour le blanc', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1)
  })
})

describe('faceColor', () => {
  it('met des yeux blancs sur un verre teinté, même vif', () => {
    expect(faceColor('#3a0ca3')).toBe('#ffffff')
    expect(faceColor('#5be370')).toBe('#ffffff')
    expect(faceColor('#6fb4ff')).toBe('#ffffff')
  })

  it('met des yeux sombres sur un fantôme presque blanc', () => {
    expect(faceColor('#ffffff')).toBe('#20242c')
    expect(faceColor('#f4f1ea')).toBe('#20242c')
  })
})

describe('mixColor', () => {
  it('va de la première à la seconde couleur', () => {
    expect(mixColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixColor('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixColor('#000000', '#ff0000', 0.5)).toBe('#800000')
  })
})

describe('shiftHue', () => {
  it('tourne la teinte sans changer le gris', () => {
    expect(shiftHue('#ff0000', 120)).toBe('#00ff00')
    expect(shiftHue('#ff0000', -120)).toBe('#0000ff')
    expect(shiftHue('#808080', 90)).toBe('#808080')
  })
})

describe('glassPalette', () => {
  it('fonce le cœur et donne au violet un reflet bleu-cyan', () => {
    const palette = glassPalette('#4a2df5', '#ffffff')
    expect(luminance(palette.core)).toBeLessThan(luminance('#4a2df5'))
    expect(luminance(palette.edge)).toBeGreaterThan(luminance('#4a2df5'))
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(palette.reflection.slice(i, i + 2), 16))
    expect(b).toBeGreaterThan(r!)
    expect(g).toBeGreaterThan(r!)
  })
})

describe('migrateLegacyAvatar', () => {
  const robot = { headColor: '#f4ead7', antennaColor: '#b5533c', eyeStyle: 'round', accessory: 'glasses', headShape: 'square' }

  it("transforme un robot en fantôme, en gardant la couleur vive de l'agent", () => {
    expect(migrateLegacyAvatar(robot)).toEqual({
      bodyColor: '#b5533c',
      glowColor: '#ffffff',
      eyeStyle: 'round',
      accessory: 'glasses',
      shape: 'classic'
    })
  })

  it('associe chaque ancienne forme à une forme de fantôme', () => {
    const shapeOf = (headShape: string): unknown => (migrateLegacyAvatar({ ...robot, headShape }) as { shape: unknown }).shape
    expect(shapeOf('capsule')).toBe('drop')
    expect(shapeOf('round')).toBe('round')
    expect(shapeOf('inconnue')).toBe('drop')
  })

  it('laisse intacte une fiche déjà convertie', () => {
    expect(migrateLegacyAvatar(DEFAULT_AVATAR)).toBe(DEFAULT_AVATAR)
    expect(migrateLegacyAvatar(null)).toBeNull()
  })
})
