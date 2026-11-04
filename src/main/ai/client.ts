import Anthropic from '@anthropic-ai/sdk'
import { readApiKey } from '../store/secrets'

let client: Anthropic | null = null

export function createClient(apiKey: string): Anthropic {
  // `authToken: null` : seule la clé saisie dans l'app sert, jamais un jeton d'environnement.
  return new Anthropic({ apiKey, authToken: null })
}

export function getClient(): Anthropic | null {
  if (client) return client
  const apiKey = readApiKey()
  if (apiKey) client = createClient(apiKey)
  return client
}

/** À appeler dès que la clé change. */
export function resetClient(): void {
  client = null
}
