import { z } from 'zod'
import { AgentDraftSchema, toDraft, type Agent, type AgentDraft } from './agent'

const FORMAT = 'agent-toolbox.agents'
const VERSION = 1
const MAX_NAME_LENGTH = 40

/** Seule la fiche des agents est exportée : ni leur mémoire, ni leurs conversations, qui sont personnelles. */
export function serializeAgents(agents: Agent[]): string {
  return JSON.stringify(
    { format: FORMAT, version: VERSION, agents: agents.map((agent) => ({ ...toDraft(agent), isFavorite: false })) },
    null,
    2
  )
}

const FileSchema = z.object({
  format: z.literal(FORMAT),
  version: z.number(),
  agents: z.array(z.unknown())
})

export interface ParsedAgents {
  drafts: AgentDraft[]
  /** Fiches ignorées car invalides, par exemple un modèle inconnu. */
  skipped: number
}

/** Lit un fichier d'export. Renvoie `null` s'il ne s'agit pas d'un export d'Agent Toolbox. */
export function parseAgentsFile(content: string): ParsedAgents | null {
  let file: z.infer<typeof FileSchema>
  try {
    file = FileSchema.parse(JSON.parse(content))
  } catch {
    return null
  }
  if (file.version > VERSION) return null
  const results = file.agents.map((agent) => AgentDraftSchema.safeParse(agent))
  const drafts = results.flatMap((result) => (result.success ? [{ ...result.data, isFavorite: false }] : []))
  return { drafts, skipped: results.length - drafts.length }
}

/** Évite deux agents de même nom : « Noa » importé à côté de « Noa » devient « Noa (2) ». */
export function uniqueName(name: string, taken: string[]): string {
  const names = new Set(taken.map((other) => other.toLowerCase()))
  if (!names.has(name.toLowerCase())) return name
  for (let index = 2; ; index++) {
    const suffix = ` (${index})`
    const candidate = `${name.slice(0, MAX_NAME_LENGTH - suffix.length)}${suffix}`
    if (!names.has(candidate.toLowerCase())) return candidate
  }
}
