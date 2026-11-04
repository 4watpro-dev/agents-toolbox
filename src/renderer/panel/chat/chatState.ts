import type { AvatarState } from '../../../shared/avatar'
import type { ChatEvent, ChatFailure } from '../../../shared/chat'
import type { Mood } from '../../../shared/moodParser'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

export interface ChatState {
  messages: ChatMessage[]
  busy: boolean
  mood: AvatarState
  notice: string | null
  failure: (ChatFailure & { retryText: string }) | null
  nextId: number
}

export const EMPTY_CHAT: ChatState = {
  messages: [],
  busy: false,
  mood: 'idle',
  notice: null,
  failure: null,
  nextId: 1
}

const MOOD_STATES: Record<Mood, AvatarState> = {
  happy: 'happy',
  surprised: 'surprised',
  confused: 'confused',
  sorry: 'sorry',
  neutral: 'idle'
}

export function sendingMessage(state: ChatState, text: string): ChatState {
  // Le tour échoué n'est jamais entré dans l'historique du modèle : l'écran doit
  // montrer la même conversation que celle que l'agent connaît.
  const base = state.failure ? dropFailedTurn(state) : state
  return {
    ...base,
    busy: true,
    mood: 'idle',
    notice: null,
    failure: null,
    messages: [...base.messages, { id: base.nextId, role: 'user', text }],
    nextId: base.nextId + 1
  }
}

/** Retire la question restée sans réponse et un éventuel début de réponse. */
export function dropFailedTurn(state: ChatState): ChatState {
  const messages = [...state.messages]
  if (messages.at(-1)?.role === 'assistant') messages.pop()
  if (messages.at(-1)?.role === 'user') messages.pop()
  return { ...state, messages, failure: null }
}

function lastUserText(messages: ChatMessage[]): string {
  return messages.findLast((message) => message.role === 'user')?.text ?? ''
}

function appendDelta(state: ChatState, text: string): ChatState {
  const last = state.messages.at(-1)
  if (last?.role === 'assistant') {
    return {
      ...state,
      messages: [...state.messages.slice(0, -1), { ...last, text: last.text + text }]
    }
  }
  return {
    ...state,
    messages: [...state.messages, { id: state.nextId, role: 'assistant', text }],
    nextId: state.nextId + 1
  }
}

export function applyChatEvent(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case 'delta':
      return appendDelta(state, event.text)
    case 'done':
      return {
        ...state,
        busy: false,
        mood: MOOD_STATES[event.mood],
        notice: event.truncated ? 'Réponse coupée : elle a atteint la longueur maximale.' : null
      }
    case 'stopped':
      return { ...state, busy: false, mood: 'idle', notice: 'Réponse interrompue.' }
    case 'error':
      return {
        ...state,
        busy: false,
        mood: 'sorry',
        failure: { ...event.failure, retryText: lastUserText(state.messages) }
      }
  }
}
