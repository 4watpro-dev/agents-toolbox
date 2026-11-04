import { z } from 'zod'

export const TurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string()
})

export const ConversationSchema = z.object({
  id: z.uuid(),
  agentId: z.string().min(1),
  title: z.string(),
  messages: z.array(TurnSchema),
  /** Session Claude Code à reprendre. `null` : repartir d'une session neuve. */
  claudeSessionId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const MemorySchema = z.object({
  agentId: z.string().min(1),
  facts: z.array(z.string())
})

export type Turn = z.infer<typeof TurnSchema>
export type Conversation = z.infer<typeof ConversationSchema>

export interface ConversationSummary {
  id: string
  title: string
  messageCount: number
  updatedAt: string
}

export const MAX_FACTS = 50
export const MAX_FACT_LENGTH = 200
const TITLE_LENGTH = 60

/** Titre tiré du premier message. */
export function conversationTitle(text: string): string {
  const line = text.trim().replace(/\s+/g, ' ')
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line
}

const normalize = (fact: string): string => fact.trim().toLowerCase()

/** Ajoute des faits sans doublon. Renvoie la liste complète et les seuls vrais ajouts. */
export function mergeFacts(existing: string[], incoming: string[]): { facts: string[]; added: string[] } {
  const seen = new Set(existing.map(normalize))
  const added: string[] = []
  for (const raw of incoming) {
    const fact = raw.trim().slice(0, MAX_FACT_LENGTH)
    if (!fact || seen.has(normalize(fact)) || existing.length + added.length >= MAX_FACTS) continue
    seen.add(normalize(fact))
    added.push(fact)
  }
  return { facts: [...existing, ...added], added }
}

/** Nettoie une liste saisie à la main : vides et doublons retirés, ordre conservé. */
export function cleanFacts(facts: string[]): string[] {
  return mergeFacts([], facts).added
}
