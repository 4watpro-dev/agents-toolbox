import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { AgentDraft } from '../../shared/agent'
import type { Result } from '../../shared/ipc'
import { getClient } from './client'
import { classifyError, MISSING_KEY, REFUSAL } from './errors'
import { GENERATION_INSTRUCTIONS, GENERATION_MODEL } from './generationPrompt'
import { GeneratedAgentSchema, normalizeGenerated } from './normalizeGenerated'

/** Propose une fiche d'agent complète à partir d'une phrase. */
export async function generateAgent(description: string): Promise<Result<AgentDraft>> {
  const client = getClient()
  if (!client) return { ok: false, message: MISSING_KEY.message }

  try {
    const response = await client.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 16000,
      system: GENERATION_INSTRUCTIONS,
      messages: [{ role: 'user', content: description }],
      output_config: { effort: 'low', format: zodOutputFormat(GeneratedAgentSchema) }
    })
    if (response.stop_reason === 'refusal') return { ok: false, message: REFUSAL.message }
    if (!response.parsed_output) {
      return { ok: false, message: "La proposition reçue était incomplète. Réessaie." }
    }
    return { ok: true, value: normalizeGenerated(response.parsed_output) }
  } catch (error) {
    console.warn(`[generate] échec : ${error instanceof Error ? error.name : 'inconnu'}`)
    return { ok: false, message: classifyError(error).message }
  }
}
