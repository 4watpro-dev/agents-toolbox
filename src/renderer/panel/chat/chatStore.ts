import { useSyncExternalStore } from 'react'
import type { AgentDraft } from '../../../shared/agent'
import {
  applyChatEvent,
  chatFromTurns,
  EMPTY_CHAT,
  forgetRemembered,
  sendingMessage,
  type ChatState
} from './chatState'

// Le magasin vit hors des composants : une réponse continue d'arriver si
// la personne revient à la galerie pendant la génération.
const sessions = new Map<string, ChatState>()
const listeners = new Set<() => void>()
let subscribedToEvents = false

function notify(): void {
  listeners.forEach((listener) => listener())
}

function update(sessionId: string, next: ChatState): void {
  sessions.set(sessionId, next)
  notify()
}

function current(sessionId: string): ChatState {
  return sessions.get(sessionId) ?? EMPTY_CHAT
}

function subscribe(listener: () => void): () => void {
  if (!subscribedToEvents) {
    subscribedToEvents = true
    window.toolbox.chat.onEvent((event) => {
      // Session réinitialisée entre-temps : la fin de son flux n'a plus de destinataire.
      if (sessions.has(event.sessionId)) update(event.sessionId, applyChatEvent(current(event.sessionId), event))
    })
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useChatSession(sessionId: string): ChatState {
  return useSyncExternalStore(subscribe, () => current(sessionId))
}

/** Charge une conversation enregistrée, sauf si elle est déjà ouverte. */
export async function loadChatSession(agentId: string, sessionId: string): Promise<void> {
  if (sessions.has(sessionId)) return
  const conversation = await window.toolbox.conversations.get(agentId, sessionId)
  if (conversation && !sessions.has(sessionId)) update(sessionId, chatFromTurns(conversation.messages))
}

export function sendChatMessage(sessionId: string, agent: AgentDraft, text: string, agentId: string | null): void {
  update(sessionId, sendingMessage(current(sessionId), text))
  window.toolbox.chat.send(sessionId, agent, text, agentId)
}

export function retryChatMessage(sessionId: string, agent: AgentDraft, agentId: string | null): void {
  const failure = current(sessionId).failure
  if (failure) sendChatMessage(sessionId, agent, failure.retryText, agentId)
}

export function stopChatMessage(sessionId: string): void {
  window.toolbox.chat.stop(sessionId)
}

export function resetChatSession(sessionId: string): void {
  window.toolbox.chat.reset(sessionId)
  sessions.delete(sessionId)
  notify()
}

/** Retire un fait que l'agent vient de retenir. */
export async function undoRemembered(sessionId: string, agentId: string, fact: string): Promise<void> {
  const facts = await window.toolbox.memory.get(agentId)
  await window.toolbox.memory.set(
    agentId,
    facts.filter((other) => other !== fact)
  )
  update(sessionId, forgetRemembered(current(sessionId), fact))
}
