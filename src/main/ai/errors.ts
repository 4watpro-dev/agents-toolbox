import Anthropic from '@anthropic-ai/sdk'
import type { ChatFailure } from '../../shared/chat'

export const MISSING_KEY: ChatFailure = {
  code: 'missing_key',
  message: "Il me faut une clé API pour répondre. Ajoute-la dans les réglages."
}

export const REFUSAL: ChatFailure = {
  code: 'refusal',
  message: 'Le filtre de sécurité de Claude a bloqué cette demande. Essaie de la reformuler.'
}

function retryDelay(error: InstanceType<typeof Anthropic.APIError>): string {
  const seconds = Number(error.headers?.get('retry-after'))
  return Number.isFinite(seconds) && seconds > 0 ? `Réessaie dans ${Math.ceil(seconds)} s.` : 'Réessaie dans un instant.'
}

/** Traduit une erreur du SDK en message clair. Les classes les plus précises passent d'abord. */
export function classifyError(error: unknown): ChatFailure {
  if (error instanceof Anthropic.AuthenticationError) {
    return { code: 'invalid_key', message: "Ta clé API n'est pas valide. Vérifie-la dans les réglages." }
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return { code: 'permission', message: "Ta clé API n'a pas accès à cette fonction ou à ce modèle." }
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { code: 'rate_limit', message: `Limite de requêtes atteinte. ${retryDelay(error)}` }
  }
  if (error instanceof Anthropic.NotFoundError) {
    return { code: 'not_found', message: "Ce modèle n'est pas disponible avec ta clé. Choisis-en un autre dans la fiche de l'agent." }
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { code: 'bad_request', message: `Claude a refusé la requête : ${error.message}` }
  }
  // Inclut les délais dépassés, qui héritent de cette classe.
  if (error instanceof Anthropic.APIConnectionError) {
    return { code: 'network', message: 'Impossible de joindre Claude. Vérifie ta connexion, puis réessaie.' }
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 402) {
      return { code: 'billing', message: 'Problème de facturation sur ton compte Anthropic. Vérifie ton crédit sur la Console Claude.' }
    }
    if (typeof error.status === 'number' && error.status >= 500) {
      return { code: 'overloaded', message: 'Claude est surchargé pour le moment. Réessaie dans un instant.' }
    }
    return { code: 'unknown', message: `Erreur de l'API Claude : ${error.message}` }
  }
  return { code: 'unknown', message: "Une erreur inattendue est survenue. Réessaie, et relance l'app si cela persiste." }
}
