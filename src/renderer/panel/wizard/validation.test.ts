import { describe, expect, it } from 'vitest'
import { AgentDraftSchema, EMPTY_DRAFT, type AgentDraft } from '../../../shared/agent'
import { finalizeDraft, firstInvalidStep, stepError } from './validation'

const complete: AgentDraft = {
  ...EMPTY_DRAFT,
  name: 'Noa',
  specialty: 'organisation',
  personality: { ...EMPTY_DRAFT.personality, catchphrases: ['', 'On y va', '  '] }
}

describe('stepError', () => {
  it('exige un nom et une spécialité à la première étape', () => {
    expect(stepError(0, EMPTY_DRAFT)).toContain('nom')
    expect(stepError(0, { ...EMPTY_DRAFT, name: 'Noa' })).toContain('spécialité')
    expect(stepError(0, complete)).toBeNull()
  })

  it('refuse un nom fait uniquement d\'espaces', () => {
    expect(stepError(0, { ...EMPTY_DRAFT, name: '   ' })).toContain('nom')
  })

  it('exige au moins une expression fétiche', () => {
    expect(stepError(2, EMPTY_DRAFT)).toContain('expression')
    expect(stepError(2, complete)).toBeNull()
  })
})

describe('outils', () => {
  const withDomains = (allowedDomains: string[], webSearch = true): AgentDraft => ({
    ...complete,
    tools: { webSearch, webFetch: false, allowedDomains }
  })

  it('accepte une liste valide ou vide', () => {
    expect(stepError(3, withDomains([]))).toBeNull()
    expect(stepError(3, withDomains(['brevo.com', 'help.example.org']))).toBeNull()
  })

  it('bloque une entrée illisible plutôt que de l\'ignorer', () => {
    expect(stepError(3, withDomains(['brevo.com', 'localhost']))).toContain('localhost')
    expect(firstInvalidStep(withDomains(['localhost']))).toBe(3)
  })

  it('oublie une liste masquée quand aucun outil web n\'est actif', () => {
    const draft = withDomains(['localhost'], false)
    expect(stepError(3, draft)).toBeNull()
    expect(AgentDraftSchema.safeParse(finalizeDraft(draft)).success).toBe(true)
  })

  it('donne aucun outil aux fiches enregistrées avant leur arrivée', () => {
    const { tools: _tools, ...older } = finalizeDraft(complete)
    expect(AgentDraftSchema.parse(older).tools).toEqual({ webSearch: false, webFetch: false, allowedDomains: [] })
  })
})

describe('firstInvalidStep', () => {
  it('pointe la première étape incomplète', () => {
    expect(firstInvalidStep(EMPTY_DRAFT)).toBe(0)
    expect(firstInvalidStep({ ...complete, personality: EMPTY_DRAFT.personality })).toBe(2)
    expect(firstInvalidStep(complete)).toBeNull()
  })
})

describe('finalizeDraft', () => {
  it('retire les expressions vides et produit un brouillon accepté par le main', () => {
    const final = finalizeDraft(complete)
    expect(final.personality.catchphrases).toEqual(['On y va'])
    expect(AgentDraftSchema.safeParse(final).success).toBe(true)
  })
})
