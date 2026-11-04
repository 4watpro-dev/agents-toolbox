import { describe, expect, it } from 'vitest'
import {
  connectorProblem,
  chatArgs,
  classifyResult,
  cleanEnv,
  isMissingSession,
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
      apiKeySource: 'none',
      servers: []
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

describe('outils web en mode abonnement', () => {
  const web = { tools: 'WebSearch,WebFetch', settings: '{"hooks":{}}', mcpConfig: null }

  it('transmet la configuration des connecteurs, sans jeton', () => {
    const args = chatArgs('prompt', 'claude-haiku-5-5', 'low', null, { tools: '', settings: '{}', mcpConfig: '{"mcpServers":{}}' })
    expect(args[args.indexOf('--mcp-config') + 1]).toBe('{"mcpServers":{}}')
    expect(args).toContain('--strict-mcp-config')
    expect(args[args.indexOf('--tools') + 1]).toBe('')
  })

  it('signale un connecteur injoignable ou qui demande une connexion', () => {
    expect(connectorProblem('Brevo', 'failed')).toContain('injoignable')
    expect(connectorProblem('Brevo', 'needs-auth')).toContain('jeton')
    expect(connectorProblem('Brevo', 'connected')).toBeNull()
    expect(connectorProblem('Brevo', 'pending')).toBeNull()
  })

  it('sans outil, Claude Code ne reçoit ni outil ni réglage', () => {
    const args = chatArgs('prompt', 'claude-haiku-5-5', 'low', null)
    expect(args[args.indexOf('--tools') + 1]).toBe('')
    expect(args).not.toContain('--settings')
  })

  it("avec outils, il reçoit ceux de l'agent et leur contrôle, en gardant son isolement", () => {
    const args = chatArgs('prompt', 'claude-haiku-5-5', 'low', 'session', web)
    expect(args[args.indexOf('--tools') + 1]).toBe('WebSearch,WebFetch')
    expect(args[args.indexOf('--settings') + 1]).toBe('{"hooks":{}}')
    expect(args).toContain('--strict-mcp-config')
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('')
    expect(args[args.indexOf('--resume') + 1]).toBe('session')
  })

  it('lit les appels d\'outils des messages de Claude Code', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Je cherche.' }, { type: 'tool_use', name: 'WebSearch', input: { query: 'tarifs' } }] }
    })
    expect(parseStreamLine(line)).toEqual({ type: 'tools', calls: [{ name: 'WebSearch', input: { query: 'tarifs' } }] })
  })

  it('ignore un message sans appel d\'outil', () => {
    expect(parseStreamLine(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Bonjour' }] } }))).toBeNull()
  })
})

describe('isMissingSession', () => {
  it('reconnaît le résultat réel d\'une session disparue', () => {
    const event = parseStreamLine(
      '{"type":"result","subtype":"error_during_execution","is_error":true,"errors":["No conversation found with session ID: 11111111-2222-4333-8444-555555555555"]}'
    )
    expect(event?.type === 'result' && isMissingSession(event.result)).toBe(true)
  })

  it('ne confond pas une autre erreur', () => {
    expect(isMissingSession(toResultEvent({ is_error: true, result: 'API Error: 529' }))).toBe(false)
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
