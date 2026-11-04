import { describe, expect, it } from 'vitest'
import { applyChatEvent, dropFailedTurn, EMPTY_CHAT, sendingMessage, type ChatState } from './chatState'

const sessionId = 's'
const send = (state: ChatState, text: string): ChatState => sendingMessage(state, text)
const delta = (state: ChatState, text: string): ChatState => applyChatEvent(state, { sessionId, type: 'delta', text })

describe('chatState', () => {
  it('assemble les fragments dans un seul message', () => {
    const state = delta(delta(send(EMPTY_CHAT, 'Salut'), 'Bon'), 'jour')
    expect(state.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'Salut'],
      ['assistant', 'Bonjour']
    ])
    expect(state.busy).toBe(true)
  })

  it('donne des identifiants uniques', () => {
    const state = delta(send(EMPTY_CHAT, 'Salut'), 'Bonjour')
    expect(new Set(state.messages.map((m) => m.id)).size).toBe(2)
  })

  it('applique l\'humeur reçue à la fin de la réponse', () => {
    const state = applyChatEvent(delta(send(EMPTY_CHAT, 'a'), 'b'), {
      sessionId,
      type: 'done',
      mood: 'happy',
      truncated: false
    })
    expect(state.mood).toBe('happy')
    expect(state.busy).toBe(false)
  })

  it('traduit neutral par l\'état de repos', () => {
    const state = applyChatEvent(send(EMPTY_CHAT, 'a'), { sessionId, type: 'done', mood: 'neutral', truncated: false })
    expect(state.mood).toBe('idle')
  })

  it('signale une réponse coupée', () => {
    const state = applyChatEvent(send(EMPTY_CHAT, 'a'), { sessionId, type: 'done', mood: 'neutral', truncated: true })
    expect(state.notice).toContain('coupée')
  })

  it('passe en mode désolé sur une erreur et garde le texte à renvoyer', () => {
    const state = applyChatEvent(send(EMPTY_CHAT, 'Ma question'), {
      sessionId,
      type: 'error',
      failure: { code: 'network', message: 'Pas de réseau' }
    })
    expect(state.mood).toBe('sorry')
    expect(state.failure?.retryText).toBe('Ma question')
  })

  it('un nouvel envoi retire le tour échoué, que le modèle n\'a jamais reçu', () => {
    const failed = applyChatEvent(delta(send(EMPTY_CHAT, 'Ratée'), 'Début'), {
      sessionId,
      type: 'error',
      failure: { code: 'refusal', message: 'Non' }
    })
    expect(send(failed, 'Nouvelle').messages.map((m) => m.text)).toEqual(['Nouvelle'])
  })

  it('un envoi normal ne retire rien', () => {
    const done = applyChatEvent(delta(send(EMPTY_CHAT, 'a'), 'b'), { sessionId, type: 'done', mood: 'neutral', truncated: false })
    expect(send(done, 'c').messages.map((m) => m.text)).toEqual(['a', 'b', 'c'])
  })

  it('retire la question et un éventuel début de réponse', () => {
    const answered = applyChatEvent(delta(send(EMPTY_CHAT, 'Avant'), 'Réponse'), {
      sessionId,
      type: 'done',
      mood: 'neutral',
      truncated: false
    })
    const failed = applyChatEvent(delta(send(answered, 'Après'), 'Début'), {
      sessionId,
      type: 'error',
      failure: { code: 'refusal', message: 'Non' }
    })
    const state = dropFailedTurn(failed)
    expect(state.messages.map((m) => m.text)).toEqual(['Avant', 'Réponse'])
    expect(state.failure).toBeNull()
  })

  it('un nouvel envoi efface l\'erreur précédente', () => {
    const failed = applyChatEvent(send(EMPTY_CHAT, 'a'), {
      sessionId,
      type: 'error',
      failure: { code: 'network', message: 'x' }
    })
    expect(send(failed, 'b').failure).toBeNull()
  })
})
