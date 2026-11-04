import type { ChatFailure } from '../../shared/chat'

/**
 * Seules ces variables passent à Claude Code. Une clé API présente dans
 * l'environnement ferait basculer la facturation sur l'API, et les autres
 * variables `ANTHROPIC_*` ou `CLAUDE_*` pourraient rediriger ses requêtes.
 */
const ALLOWED_ENV = ['HOME', 'USER', 'LOGNAME', 'PATH', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'LC_CTYPE'] as const

export function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {}
  for (const name of ALLOWED_ENV) {
    if (env[name] !== undefined) clean[name] = env[name]
  }
  return clean
}

/**
 * Options communes : un agent discute et rien d'autre. Il n'a aucun outil, et ne
 * charge ni tes réglages, ni tes hooks, ni tes serveurs MCP, ni tes skills.
 */
function isolationArgs(systemPrompt: string, model: string, effort: string): string[] {
  return [
    '-p',
    '--verbose',
    '--model',
    model,
    '--effort',
    effort,
    '--system-prompt',
    systemPrompt,
    '--tools',
    '',
    '--strict-mcp-config',
    '--setting-sources',
    '',
    '--disable-slash-commands'
  ]
}

export function chatArgs(systemPrompt: string, model: string, effort: string, resumeId: string | null): string[] {
  return [
    ...isolationArgs(systemPrompt, model, effort),
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    ...(resumeId ? ['--resume', resumeId] : [])
  ]
}

export function structuredArgs(
  systemPrompt: string,
  model: string,
  effort: string,
  jsonSchema: Record<string, unknown>
): string[] {
  // Claude Code rejette tout le schéma si `$schema`, que zod ajoute, y figure.
  const { $schema: _ignored, ...schema } = jsonSchema
  return [
    ...isolationArgs(systemPrompt, model, effort),
    '--output-format',
    'stream-json',
    '--json-schema',
    JSON.stringify(schema),
    '--no-session-persistence'
  ]
}

export interface Turn {
  role: 'user' | 'assistant'
  text: string
}

/** Repart d'une session neuve en lui redonnant les échanges réussis, sous forme de texte. */
export function promptWithHistory(turns: Turn[], text: string): string {
  if (turns.length === 0) return text
  const transcript = turns
    .map((turn) => `${turn.role === 'user' ? 'La personne' : 'Toi'} : ${turn.text}`)
    .join('\n\n')
  return `Voici le début de votre conversation, pour le contexte :\n\n<conversation>\n${transcript}\n</conversation>\n\nLa personne te dit maintenant :\n\n${text}`
}

export interface ResultEvent {
  isError: boolean
  text: string
  stopReason: string | null
  terminalReason: string | null
  apiStatus: number | null
  sessionId: string | null
  structuredOutput: unknown
}

export type StreamEvent =
  | { type: 'init'; sessionId: string | null; apiKeySource: string | null }
  | { type: 'text'; text: string }
  | { type: 'result'; result: ResultEvent }

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function toResultEvent(data: Record<string, unknown>): ResultEvent {
  return {
    isError: data['is_error'] === true,
    text: stringOrNull(data['result']) ?? '',
    stopReason: stringOrNull(data['stop_reason']),
    terminalReason: stringOrNull(data['terminal_reason']),
    apiStatus: typeof data['api_error_status'] === 'number' ? data['api_error_status'] : null,
    sessionId: stringOrNull(data['session_id']),
    structuredOutput: data['structured_output']
  }
}

/** Lit une ligne de la sortie `stream-json`. Les lignes sans intérêt pour le chat donnent `null`. */
export function parseStreamLine(line: string): StreamEvent | null {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(line) as Record<string, unknown>
  } catch {
    return null
  }
  if (data['type'] === 'system' && data['subtype'] === 'init') {
    return { type: 'init', sessionId: stringOrNull(data['session_id']), apiKeySource: stringOrNull(data['apiKeySource']) }
  }
  if (data['type'] === 'stream_event') {
    const event = data['event'] as { type?: string; delta?: { type?: string; text?: string } } | undefined
    if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
      return { type: 'text', text: event.delta.text }
    }
    return null
  }
  if (data['type'] === 'result') return { type: 'result', result: toResultEvent(data) }
  return null
}

export const NOT_LOGGED_IN: ChatFailure = {
  code: 'not_logged_in',
  message: "Claude Code n'est pas connecté à ton abonnement. Connecte-le depuis les réglages."
}

export const CLI_MISSING: ChatFailure = {
  code: 'cli_missing',
  message: "Claude Code est introuvable sur ce Mac. Installe-le, puis réessaie."
}

export const NOT_ON_PLAN: ChatFailure = {
  code: 'not_on_plan',
  message:
    "Claude Code utilise une clé API facturée à l'usage, pas ton abonnement. Rien n'a été envoyé. Reconnecte-le avec ton abonnement depuis les réglages."
}

/** Avec ces valeurs, rien n'est facturé sur une clé : l'usage passe par le forfait. */
export function isPlanBilled(apiKeySource: string | null): boolean {
  return apiKeySource === null || apiKeySource === 'none'
}

/**
 * Traduit un résultat en échec, ou `null` s'il a réussi. Claude Code ne donne pas
 * toujours de code HTTP : à défaut, seul son message permet de reconnaître la cause.
 */
export function classifyResult(result: ResultEvent): ChatFailure | null {
  if (result.stopReason === 'refusal') {
    return { code: 'refusal', message: 'Le filtre de sécurité de Claude a bloqué cette demande. Essaie de la reformuler.' }
  }
  if (!result.isError) return null

  const { apiStatus, text } = result
  if (apiStatus === 401 || apiStatus === 403 || /authenticat|log ?in|oauth|credential/i.test(text)) {
    return NOT_LOGGED_IN
  }
  if (apiStatus === 429 || apiStatus === 402 || /\blimit\b|usage credits?|extra usage/i.test(text)) {
    return { code: 'plan_limit', message: `Limite de ton forfait atteinte. Rien ne sera facturé : attends sa remise à zéro. (${text.slice(0, 160)})` }
  }
  if (apiStatus === 404 || /model.*(not found|not available|may not exist)/i.test(text)) {
    return { code: 'not_found', message: "Ce modèle n'est pas disponible avec ton forfait. Choisis-en un autre dans la fiche de l'agent." }
  }
  if (apiStatus !== null && apiStatus >= 500) {
    return { code: 'overloaded', message: 'Claude est surchargé pour le moment. Réessaie dans un instant.' }
  }
  if (/connect|network|fetch failed|timed? ?out|ENOTFOUND|ECONN|socket/i.test(text)) {
    return { code: 'network', message: 'Impossible de joindre Claude. Vérifie ta connexion, puis réessaie.' }
  }
  return { code: 'unknown', message: `Claude Code a signalé une erreur : ${text.slice(0, 200) || 'sans détail'}` }
}
