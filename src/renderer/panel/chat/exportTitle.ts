import { conversationTitle } from '../../../shared/conversation'

/** Titre d'un document exporté : la question posée, sinon l'auteur de la réponse. */
export function exportTitle(author: string, question: string | undefined): string {
  const asked = question ? conversationTitle(question.replace(/^\[[^\]]*\]\s*/, '')) : ''
  return asked || `Réponse de ${author}`
}
