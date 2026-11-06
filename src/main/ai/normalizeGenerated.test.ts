import { describe, expect, it } from 'vitest'
import { normalizeGenerated, type GeneratedAgent } from './normalizeGenerated'

const generated: GeneratedAgent = {
  name: 'Lou',
  specialty: 'coach vocal',
  category: 'Perso',
  description: 'Aide à parler en public.',
  bodyColor: '#8e5cf6',
  glowColor: '#ffe0e6',
  eyeStyle: 'round',
  accessory: 'bowtie',
  shape: 'round',
  formality: 72,
  detail: 40,
  humor: 60,
  boldness: 50,
  tuVous: 'tu',
  traits: ['patient', 'direct'],
  catchphrases: ['On respire.'],
  backstory: 'Lou a été comédienne.',
  instructions: 'Fais répéter.',
  greeting: 'Prête ?'
}

describe('normalizeGenerated', () => {
  it('transforme la proposition en brouillon valide', () => {
    const draft = normalizeGenerated(generated)
    expect(draft.name).toBe('Lou')
    expect(draft.avatar.accessory).toBe('bowtie')
    expect(draft.model).toBe('claude-sonnet-5-5')
    expect(draft.isFavorite).toBe(false)
  })

  it('ramène les curseurs dans les limites et sur le pas de 5', () => {
    const { sliders } = normalizeGenerated({ ...generated, formality: 72, detail: -10, humor: 140 }).personality
    expect(sliders.formality).toBe(70)
    expect(sliders.detail).toBe(0)
    expect(sliders.humor).toBe(100)
  })

  it('remplace une couleur mal formée', () => {
    const { avatar } = normalizeGenerated({ ...generated, bodyColor: 'rose', glowColor: '#12' })
    expect(avatar.bodyColor).toBe('#5be370')
    expect(avatar.glowColor).toBe('#ffffff')
  })

  it('limite les expressions et retire les vides', () => {
    const { catchphrases } = normalizeGenerated({
      ...generated,
      catchphrases: ['a', '  ', 'b', 'c', 'd']
    }).personality
    expect(catchphrases).toEqual(['a', 'b', 'c'])
  })

  it('tronque un nom trop long plutôt que de tout refuser', () => {
    expect(normalizeGenerated({ ...generated, name: 'x'.repeat(100) }).name).toHaveLength(40)
  })

  it('refuse une proposition sans nom', () => {
    expect(() => normalizeGenerated({ ...generated, name: '  ' })).toThrow()
  })
})
