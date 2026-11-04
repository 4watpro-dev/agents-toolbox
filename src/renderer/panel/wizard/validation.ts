import type { AgentDraft } from '../../../shared/agent'

export const STEPS = ['Identité', 'Apparence', 'Personnalité', 'Compétences'] as const

/** Message à afficher si l'étape est incomplète, sinon `null`. */
export function stepError(step: number, draft: AgentDraft): string | null {
  if (step === 0) {
    if (!draft.name.trim()) return 'Donne un nom à ton agent.'
    if (!draft.specialty.trim()) return 'Indique sa spécialité.'
  }
  if (step === 2 && !draft.personality.catchphrases.some((phrase) => phrase.trim())) {
    return 'Ajoute au moins une expression fétiche.'
  }
  return null
}

/** Première étape incomplète, ou `null` si tout est prêt à enregistrer. */
export function firstInvalidStep(draft: AgentDraft): number | null {
  const index = STEPS.findIndex((_, step) => stepError(step, draft) !== null)
  return index === -1 ? null : index
}

/** Nettoie les champs que le formulaire garde vides pendant la saisie. */
export function finalizeDraft(draft: AgentDraft): AgentDraft {
  return {
    ...draft,
    personality: {
      ...draft.personality,
      catchphrases: draft.personality.catchphrases.map((phrase) => phrase.trim()).filter(Boolean)
    }
  }
}
