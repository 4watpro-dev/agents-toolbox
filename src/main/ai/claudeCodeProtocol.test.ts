import { describe, expect, it } from 'vitest'
import {
  chatArgs,
  classifyResult,
  cleanEnv,
  isPlanBilled,
  parseStreamLine,
  promptWithHistory,
  structuredArgs,
  toResultEvent,
  type ResultEvent
} from './claudeCodeProtocol'

const failure = (patch: Partial<ResultEvent>): ResultEvent => ({
  isError: true,
  text: '',
  stopReason: null,
  terminalReason: 'api_error',
  apiStatus: null,
  sessionId: null,
  structuredOutput: undefined,
  ...patch
})

describe('cleanEnv', () => {
  it('ne laisse jamais passer une clé ou une redirection', () => {
    const env = cleanEnv({
      HOME: '/Users/x',
      PATH: '/bin',
      ANTHROPIC_API_KEY: 'secret',
      ANTHROPIC_AUTH_TOKEN: 'secret',
      ANTHROPIC_BASE_URL: 'http://proxy',
      CLAUDE_CODE_OAUTH_TOKEN: 'secret',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDECODE: '1'
    })
    expect(env).toEqual({ HOME: '/Users/x', PATH: '/bin' })
  })
})

describe('chatArgs', () => {
  const args = chatArgs('Prompt', 'claude-sonnet-5-5', 'low', null)

  it('coupe tous les outils et toutes les personnalisations', () => {
    expect(args[args.indexOf('--tools') + 1]).toBe('')
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('')
    expect(args).toContain('--strict-mcp-config')
    expect(args).toContain('--disable-slash-commands')
  })

  it("transmet le prompt, le modèle et l'effort de l'agent", () => {
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('Prompt')
    expect(args[args.indexOf('--model') + 1]).toBe('claude-sonnet-5-5')
    expect(args[args.indexOf('--effort') + 1]).toBe('low')
  })

  it('reprend une session seulement quand elle existe', () => {
    expect(args).not.toContain('--resume')
    const resumed = chatArgs('Prompt', 'm', 'low', 'abc')
    expect(resumed[resumed.indexOf('--resume') + 1]).toBe('abc')
  })

  it('ne contourne jamais les permissions', () => {
    expect(args.join(' ')).not.toMatch(/bypass|dangerously/)
  })
})

describe('structuredArgs', () => {
  it('demande le schéma et ne laisse aucune session', () => {
    const args = structuredArgs('P', 'm', 'low', { type: 'object' })
    expect(args[args.indexOf('--json-schema') + 1]).toBe('{"type":"object"}')
    expect(args).toContain('--no-session-persistence')
    expect(args[args.indexOf('--tools') + 1]).toBe('')
  })
})

describe('structuredArgs avec un schéma zod', () => {
  it('retire le champ $schema, que Claude Code refuse', () => {
    const args = structuredArgs('P', 'm', 'low', {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object'
    })
    expect(JSON.parse(args[args.indexOf('--json-schema') + 1])).toEqual({ type: 'object' })
  })
})

describe('promptWithHistory', () => {
  it('renvoie le message seul sans historique', () => {
    expect(promptWithHistory([], 'Salut')).toBe('Salut')
  })

  it('redonne les échanges puis le nouveau message', () => {
    const prompt = promptWithHistory(
      [
        { role: 'user', text: 'Question' },
        { role: 'assistant', text: 'Réponse' }
      ],
      'Suite'
    )
    expect(prompt.indexOf('La personne : Question')).toBeLessThan(prompt.indexOf('Toi : Réponse'))
    expect(prompt.endsWith('Suite')).toBe(true)
  })
})

describe('parseStreamLine', () => {
  it('lit la session et la source de facturation', () => {
    expect(parseStreamLine('{"type":"system","subtype":"init","session_id":"s1","apiKeySource":"none"}')).toEqual({
      type: 'init',
      sessionId: 's1',
      apiKeySource: 'none'
    })
  })

  it('extrait le texte diffusé', () => {
    const line = JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Bon' } }
    })
    expect(parseStreamLine(line)).toEqual({ type: 'text', text: 'Bon' })
  })

  it('ignore la réflexion, les messages complets et les lignes illisibles', () => {
    const thinking = JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'x' } }
    })
    expect(parseStreamLine(thinking)).toBeNull()
    expect(parseStreamLine('{"type":"assistant","message":{}}')).toBeNull()
    expect(parseStreamLine('pas du json')).toBeNull()
  })

  it('lit le résultat réel renvoyé sans connexion', () => {
    const event = parseStreamLine(
      '{"type":"result","subtype":"success","is_error":true,"result":"Failed to authenticate: OAuth session expired and could not be refreshed","stop_reason":"stop_sequence","terminal_reason":"api_error","api_error_status":null,"session_id":"s"}'
    )
    expect(event?.type).toBe('result')
    if (event?.type === 'result') expect(classifyResult(event.result)?.code).toBe('not_logged_in')
  })
})

describe('isPlanBilled', () => {
  it("n'accepte que l'absence de clé", () => {
    expect(isPlanBilled('none')).toBe(true)
    expect(isPlanBilled(null)).toBe(true)
    expect(isPlanBilled('ANTHROPIC_API_KEY')).toBe(false)
    expect(isPlanBilled('/login managed key')).toBe(false)
  })
})

describe('classifyResult', () => {
  it('accepte un résultat réussi', () => {
    expect(classifyResult(toResultEvent({ is_error: false, result: 'ok', stop_reason: 'end_turn' }))).toBeNull()
  })

  it.each([
    [{ apiStatus: 401 }, 'not_logged_in'],
    [{ text: 'Not logged in · Please run /login' }, 'not_logged_in'],
    [{ apiStatus: 429 }, 'plan_limit'],
    [{ text: "You've hit your limit · resets 3pm" }, 'plan_limit'],
    [{ apiStatus: 404 }, 'not_found'],
    [{ apiStatus: 529 }, 'overloaded'],
    [{ text: 'Unable to connect to API (ConnectionRefused)' }, 'network'],
    [{ text: 'quelque chose d\'autre' }, 'unknown']
  ] as const)('%o donne %s', (patch, code) => {
    expect(classifyResult(failure(patch))?.code).toBe(code)
  })

  it('reconnaît un refus même sans erreur signalée', () => {
    expect(classifyResult(failure({ isError: false, stopReason: 'refusal' }))?.code).toBe('refusal')
  })

  it('rassure sur la facturation quand la limite du forfait est atteinte', () => {
    expect(classifyResult(failure({ apiStatus: 429 }))?.message).toContain('Rien ne sera facturé')
  })
})
