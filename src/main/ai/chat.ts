import Anthropic from '@anthropic-ai/sdk'
import type { AgentDraft } from '../../shared/agent'
import type { ChatEvent } from '../../shared/chat'
import { createReplyParser } from '../../shared/replyParser'
import type { TurnContext } from './claudeCodeProtocol'
import { getClient } from './client'
import { classifyError, MISSING_KEY, REFUSAL } from './errors'
import { toHistoryContent } from './history'

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam
type Emit = (event: ChatEvent) => void

const MAX_TOKENS = 64000
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

const histories = new Map<string, MessageParam[]>()
const activeStreams = new Map<string, { abort(): void }>()

/** Haiku n'a pas de repli serveur : il répond seul, et un refus reste un refus. */
function fallbackParams(model: string): { betas: string[]; fallbacks: 'default' } | Record<string, never> {
  return model.startsWith('claude-haiku') ? {} : { betas: [FALLBACK_BETA], fallbacks: 'default' }
}

export async function sendMessage(
  sessionId: string,
  agent: AgentDraft,
  text: string,
  emit: Emit,
  context: TurnContext
): Promise<void> {
  if (activeStreams.has(sessionId)) return

  const client = getClient()
  if (!client) {
    emit({ sessionId, type: 'error', failure: MISSING_KEY })
    return
  }

  // Après une relance, on repart du texte conservé : les blocs de réflexion ne sont pas enregistrés.
  const history: MessageParam[] =
    histories.get(sessionId) ?? context.turns.map((turn) => ({ role: turn.role, content: turn.text }))
  const userMessage: MessageParam = { role: 'user', content: text }
  const parser = createReplyParser()
  let visibleText = ''

  const stream = client.beta.messages.stream({
    model: agent.model,
    max_tokens: MAX_TOKENS,
    system: context.systemPrompt,
    messages: [...history, userMessage],
    output_config: { effort: agent.effort },
    cache_control: { type: 'ephemeral' },
    ...fallbackParams(agent.model)
  })
  activeStreams.set(sessionId, stream)

  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const visible = parser.push(event.delta.text)
        if (visible) {
          visibleText += visible
          emit({ sessionId, type: 'delta', text: visible })
        }
      }
    }
    const message = await stream.finalMessage()

    // Un refus peut survenir en cours de réponse : ce début de texte n'entre pas dans l'historique.
    if (message.stop_reason === 'refusal') {
      emit({ sessionId, type: 'error', failure: REFUSAL })
      return
    }

    const { text: rest, mood, facts } = parser.finish()
    if (rest) emit({ sessionId, type: 'delta', text: rest })
    histories.set(sessionId, [
      ...history,
      userMessage,
      { role: 'assistant', content: toHistoryContent(message.content) }
    ])
    emit({ sessionId, type: 'done', mood, truncated: message.stop_reason === 'max_tokens', facts })
  } catch (error) {
    if (error instanceof Anthropic.APIUserAbortError) {
      // Réponse interrompue : on garde ce qui a été affiché pour que la suite ait le contexte.
      const partial = visibleText.trim()
      histories.set(sessionId, [
        ...history,
        userMessage,
        ...(partial ? [{ role: 'assistant' as const, content: partial }] : [])
      ])
      emit({ sessionId, type: 'stopped' })
      return
    }
    // Échec : rien n'entre dans l'historique, la personne peut réessayer.
    console.warn(`[chat] échec : ${error instanceof Error ? error.name : 'inconnu'}`)
    emit({ sessionId, type: 'error', failure: classifyError(error) })
  } finally {
    activeStreams.delete(sessionId)
  }
}

export function stopMessage(sessionId: string): void {
  activeStreams.get(sessionId)?.abort()
}

export function forgetApiSessions(): void {
  for (const sessionId of histories.keys()) {
    if (!activeStreams.has(sessionId)) histories.delete(sessionId)
  }
}

export function resetSession(sessionId: string): void {
  stopMessage(sessionId)
  histories.delete(sessionId)
}
