import { describe, expect, it } from 'vitest'
import { EMPTY_DRAFT, type AgentDraft } from './agent'
import { buildSystemPrompt, composePrompt } from './systemPrompt'

const draft = (patch: Partial<AgentDraft> = {}, personality: Partial<AgentDraft['personality']> = {}): AgentDraft => ({
  ...EMPTY_DRAFT,
  name: 'Basile',
  specialty: 'relecteur de textes',
  ...patch,
  personality: { ...EMPTY_DRAFT.personality, ...personality }
})

const sliders = (patch: Partial<AgentDraft['personality']['sliders']>) => ({
  sliders: { ...EMPTY_DRAFT.personality.sliders, ...patch }
})

describe('composePrompt', () => {
  it("présente l'agent par son nom et sa spécialité", () => {
    expect(composePrompt(draft())).toContain('Tu es Basile, relecteur de textes.')
  })

  it("n'ajoute aucune consigne de style pour un curseur neutre", () => {
    expect(composePrompt(draft())).not.toContain('registre')
  })

  it('traduit les extrémités des curseurs', () => {
    expect(composePrompt(draft({}, sliders({ formality: 0 })))).toContain('soutenu')
    expect(composePrompt(draft({}, sliders({ formality: 100 })))).toContain('décontracté')
    expect(composePrompt(draft({}, sliders({ detail: 10 })))).toContain('droit au but')
    expect(composePrompt(draft({}, sliders({ boldness: 90 })))).toContain('audacieux')
  })

  it('applique le tutoiement ou le vouvoiement', () => {
    expect(composePrompt(draft({}, { tuVous: 'tu' }))).toContain('Tu tutoies')
    expect(composePrompt(draft({}, { tuVous: 'vous' }))).toContain('Tu vouvoies')
  })

  it('demande de la modération sur les expressions fétiches', () => {
    const prompt = composePrompt(draft({}, { catchphrases: ['Allez, on y va'] }))
    expect(prompt).toContain('« Allez, on y va »')
    expect(prompt).toContain('jamais à chaque message')
  })

  it('omet les sections vides', () => {
    const prompt = composePrompt(draft())
    expect(prompt).not.toContain('Ton histoire')
    expect(prompt).not.toContain('Tes expressions')
    expect(prompt).not.toContain('Ton métier')
    expect(prompt).not.toContain('Ton caractère')
  })
})

describe('buildSystemPrompt', () => {
  it("garde la consigne d'humeur même avec un prompt manuel", () => {
    const prompt = buildSystemPrompt(draft({ systemPromptOverride: 'Tu es un pirate.' }))
    expect(prompt.startsWith('Tu es un pirate.')).toBe(true)
    expect(prompt).not.toContain('Tu es Basile')
    expect(prompt).toContain('[mood:sorry]')
  })

  it("signale le message d'accueil, déjà affiché à la personne", () => {
    expect(buildSystemPrompt(draft({ greeting: 'Salut !' }))).toContain('« Salut ! »')
    expect(buildSystemPrompt(draft())).not.toContain('Ton accueil')
  })

  it('ajoute les faits retenus', () => {
    const prompt = buildSystemPrompt(draft(), ['Travaille à Brest'])
    expect(prompt).toContain('- Travaille à Brest')
  })

  it('omet la section des faits quand il n\'y en a pas', () => {
    expect(buildSystemPrompt(draft())).not.toContain('Ce que tu sais')
  })
})
