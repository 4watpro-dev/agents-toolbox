import { useSyncExternalStore } from 'react'
import type { AgentDraft } from '../../../shared/agent'
import { applyChatEvent, EMPTY_CHAT, sendingMessage, type ChatState } from './chatState'

// Le magasin vit hors des composants : une réponse continue d'arriver si
// la personne revient à la galerie pendant la génération.
const sessions = new Map<string, ChatState>()
const listeners = new Set<() => void>()
let subscribedToEvents = false

function update(sessionId: string, next: ChatState): void {
  sessions.set(sessionId, next)
  listeners.forEach((listener) => listener())
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

export function sendChatMessage(sessionId: string, agent: AgentDraft, text: string): void {
  update(sessionId, sendingMessage(current(sessionId), text))
  window.toolbox.chat.send(sessionId, agent, text)
}

export function retryChatMessage(sessionId: string, agent: AgentDraft): void {
  const failure = current(sessionId).failure
  if (failure) sendChatMessage(sessionId, agent, failure.retryText)
}

export function stopChatMessage(sessionId: string): void {
  window.toolbox.chat.stop(sessionId)
}

export function resetChatSession(sessionId: string): void {
  window.toolbox.chat.reset(sessionId)
  sessions.delete(sessionId)
  listeners.forEach((listener) => listener())
}
