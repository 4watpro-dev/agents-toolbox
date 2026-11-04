import type { AvatarState } from '../../../shared/avatar'
import type { ChatEvent, ChatFailure } from '../../../shared/chat'
import type { Turn } from '../../../shared/conversation'
import type { Mood } from '../../../shared/replyParser'
import type { ToolActivity } from '../../../shared/tools'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

export interface ChatState {
  messages: ChatMessage[]
  busy: boolean
  /** Outil en cours d'utilisation, jusqu'à ce que le texte reprenne. */
  activity: ToolActivity | null
  mood: AvatarState
  notice: string | null
  failure: (ChatFailure & { retryText: string }) | null
  /** Faits retenus au dernier tour, signalés dans le chat avec la possibilité de les retirer. */
  remembered: string[]
  nextId: number
}

export const EMPTY_CHAT: ChatState = {
  messages: [],
  busy: false,
  activity: null,
  mood: 'idle',
  notice: null,
  failure: null,
  remembered: [],
  nextId: 1
}

/** État d'une conversation rouverte depuis l'historique. */
export function chatFromTurns(turns: Turn[]): ChatState {
  return {
    ...EMPTY_CHAT,
    messages: turns.map((turn, index) => ({ id: index + 1, role: turn.role, text: turn.text })),
    nextId: turns.length + 1
  }
}

export function forgetRemembered(state: ChatState, fact: string): ChatState {
  return { ...state, remembered: state.remembered.filter((other) => other !== fact) }
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
    remembered: [],
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
      return { ...appendDelta(state, event.text), activity: null }
    case 'tool':
      return { ...state, activity: event.activity }
    case 'done':
      return {
        ...state,
        busy: false,
        activity: null,
        mood: MOOD_STATES[event.mood],
        remembered: event.facts,
        notice: event.truncated ? 'Réponse coupée : elle a atteint la longueur maximale.' : null
      }
    case 'stopped':
      return { ...state, busy: false, activity: null, mood: 'idle', notice: 'Réponse interrompue.' }
    case 'error':
      return {
        ...state,
        busy: false,
        activity: null,
        mood: 'sorry',
        failure: { ...event.failure, retryText: lastUserText(state.messages) }
      }
  }
}
