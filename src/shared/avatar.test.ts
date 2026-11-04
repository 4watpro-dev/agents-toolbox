import { describe, expect, it } from 'vitest'
import { faceColor, luminance } from './avatar'

describe('luminance', () => {
  it('donne 0 pour le noir et 1 pour le blanc', () => {
    expect(luminance('#000000')).toBe(0)
    expect(luminance('#ffffff')).toBeCloseTo(1)
  })
})

describe('faceColor', () => {
  it('met des yeux sombres sur une tête claire', () => {
    expect(faceColor('#ffffff')).toBe('#20242c')
    expect(faceColor('#ffd166')).toBe('#20242c')
  })

  it('met des yeux clairs sur une tête sombre', () => {
    expect(faceColor('#1f2937')).toBe('#f5f7fa')
    expect(faceColor('#3a0ca3')).toBe('#f5f7fa')
  })
})
