import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR, faceColor, luminance, migrateLegacyAvatar } from './avatar'

describe('luminance', () => {
  it('donne 0 pour le noir et 1 pour le blanc', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1)
  })
})

describe('faceColor', () => {
  it('met des yeux sombres sur un corps clair', () => {
    expect(faceColor('#ffffff')).toBe('#20242c')
    expect(faceColor('#ffd166')).toBe('#20242c')
  })

  it('met des yeux clairs sur un corps très sombre', () => {
    expect(faceColor('#1f2937')).toBe('#f5f7fa')
    expect(faceColor('#3a0ca3')).toBe('#f5f7fa')
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
