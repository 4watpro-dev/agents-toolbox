import { spawn, type ChildProcess } from 'node:child_process'
import { accessSync, constants, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { createInterface } from 'node:readline'
import { app } from 'electron'
import { z } from 'zod'
import type { AgentDraft } from '../../shared/agent'
import type { ChatEvent, ChatFailure } from '../../shared/chat'
import type { Result, SubscriptionStatus } from '../../shared/ipc'
import { createMoodParser } from '../../shared/moodParser'
import { buildSystemPrompt } from '../../shared/systemPrompt'
import {
  chatArgs,
  classifyResult,
  cleanEnv,
  CLI_MISSING,
  isPlanBilled,
  NOT_ON_PLAN,
  parseStreamLine,
  promptWithHistory,
  structuredArgs,
  type ResultEvent,
  type Turn
} from './claudeCodeProtocol'
import { GENERATION_INSTRUCTIONS, GENERATION_MODEL } from './generationPrompt'
import { GeneratedAgentSchema, normalizeGenerated } from './normalizeGenerated'

type Emit = (event: ChatEvent) => void

const STOP_GRACE_MS = 2000
const STATUS_TIMEOUT_MS = 8000
const GENERATION_TIMEOUT_MS = 180_000

interface Session {
  /** Échanges réussis : permettent de repartir d'une session neuve après un échec. */
  turns: Turn[]
  /** `null` : la prochaine requête ouvre une session neuve, avec l'historique en texte. */
  resumeId: string | null
}

const sessions = new Map<string, Session>()
const running = new Map<string, { child: ChildProcess; stop(): void }>()

/** Une app lancée depuis le Finder ou au démarrage n'a pas le PATH du terminal. */
function findBinary(): string | null {
  const directories = [
    ...(process.env['PATH'] ?? '').split(delimiter),
    join(homedir(), '.local/bin'),
    join(homedir(), '.claude/local'),
    '/opt/homebrew/bin',
    '/usr/local/bin'
  ]
  for (const directory of directories) {
    if (!directory) continue
    const candidate = join(directory, 'claude')
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // Absent de ce dossier : on essaie le suivant.
    }
  }
  return null
}

/** Dossier vide : aucun fichier CLAUDE.md ni réglage de projet ne peut s'y trouver. */
function neutralDirectory(): string {
  const directory = join(app.getPath('userData'), 'claude-code')
  mkdirSync(directory, { recursive: true })
  return directory
}

function launch(binary: string, args: string[]): ChildProcess {
  const child = spawn(binary, args, {
    cwd: neutralDirectory(),
    env: cleanEnv(process.env),
    stdio: ['pipe', 'pipe', 'pipe']
  })
  // Une option refusée n'est signalée que là : sans ce journal, la cause reste invisible.
  child.stderr!.setEncoding('utf8').on('data', (chunk: string) => {
    console.warn(`[claude-code] ${chunk.trim().slice(0, 300)}`)
  })
  return child
}

export function sendViaClaudeCode(sessionId: string, agent: AgentDraft, text: string, emit: Emit): void {
  if (running.has(sessionId)) return

  const binary = findBinary()
  if (!binary) {
    emit({ sessionId, type: 'error', failure: CLI_MISSING })
    return
  }

  const session = sessions.get(sessionId) ?? { turns: [], resumeId: null }
  sessions.set(sessionId, session)
  const prompt = session.resumeId ? text : promptWithHistory(session.turns, text)
  const args = chatArgs(buildSystemPrompt(agent), agent.model, agent.effort, session.resumeId)

  const parser = createMoodParser()
  const child = launch(binary, args)
  let visibleText = ''
  let newSessionId: string | null = null
  let result: ResultEvent | null = null
  let stopped = false
  let blocked: ChatFailure | null = null
  let spawnFailed = false
  let killTimer: NodeJS.Timeout | null = null

  const stop = (): void => {
    stopped = true
    child.kill('SIGINT')
    killTimer = setTimeout(() => child.kill('SIGKILL'), STOP_GRACE_MS)
  }
  running.set(sessionId, { child, stop })

  const lines = createInterface({ input: child.stdout! })
  lines.on('line', (line) => {
    const event = parseStreamLine(line)
    if (!event) return
    if (event.type === 'init') {
      newSessionId = event.sessionId
      // Garde-fou : si la facturation ne passe pas par le forfait, on arrête tout de suite.
      if (!isPlanBilled(event.apiKeySource)) {
        blocked = NOT_ON_PLAN
        child.kill('SIGKILL')
      }
    } else if (event.type === 'text') {
      const visible = parser.push(event.text)
      if (visible) {
        visibleText += visible
        emit({ sessionId, type: 'delta', text: visible })
      }
    } else {
      result = event.result
    }
  })

  child.stdin!.on('error', () => undefined)
  child.stdin!.end(prompt)

  child.on('error', () => {
    spawnFailed = true
  })

  child.on('close', () => {
    lines.close()
    if (killTimer) clearTimeout(killTimer)
    running.delete(sessionId)
    // Session réinitialisée entre-temps : plus personne n'attend cette réponse.
    if (!sessions.has(sessionId)) return
    // Sans réponse complète, la session Claude Code contient un tour que l'écran
    // n'affiche plus. La suite repartira donc d'une session neuve.
    session.resumeId = null

    if (blocked) {
      emit({ sessionId, type: 'error', failure: blocked })
      return
    }
    if (spawnFailed) {
      emit({ sessionId, type: 'error', failure: CLI_MISSING })
      return
    }
    if (stopped) {
      const partial = visibleText.trim()
      session.turns.push({ role: 'user', text })
      if (partial) session.turns.push({ role: 'assistant', text: partial })
      emit({ sessionId, type: 'stopped' })
      return
    }
    const finished = result as ResultEvent | null
    if (!finished) {
      emit({
        sessionId,
        type: 'error',
        failure: { code: 'unknown', message: "Claude Code s'est arrêté sans répondre. Réessaie." }
      })
      return
    }
    const failure = classifyResult(finished)
    if (failure) {
      emit({ sessionId, type: 'error', failure })
      return
    }

    const { text: rest, mood } = parser.finish()
    if (rest) emit({ sessionId, type: 'delta', text: rest })
    session.turns.push({ role: 'user', text }, { role: 'assistant', text: (visibleText + rest).trim() })
    session.resumeId = finished.sessionId ?? newSessionId
    emit({ sessionId, type: 'done', mood, truncated: finished.stopReason === 'max_tokens' })
  })
}

export function stopViaClaudeCode(sessionId: string): void {
  running.get(sessionId)?.stop()
}

export function resetClaudeCodeSession(sessionId: string): void {
  sessions.delete(sessionId)
  running.get(sessionId)?.child.kill('SIGKILL')
}

export function stopAllClaudeCode(): void {
  for (const { child } of running.values()) child.kill('SIGKILL')
}

interface Output {
  code: number | null
  stdout: string
}

function collect(binary: string, args: string[], input: string | null, timeoutMs: number): Promise<Output | null> {
  return new Promise((resolve) => {
    const child = launch(binary, args)
    let stdout = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.stdout!.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk))
    child.stdin!.on('error', () => undefined)
    child.stdin!.end(input ?? undefined)
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout })
    })
  })
}

type RunOutcome = { kind: 'result'; result: ResultEvent } | { kind: 'failure'; failure: ChatFailure }

/** Exécute une requête jusqu'à son résultat, avec le même garde-fou de facturation que le chat. */
function runToResult(binary: string, args: string[], input: string): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const child = launch(binary, args)
    const timer = setTimeout(() => child.kill('SIGKILL'), GENERATION_TIMEOUT_MS)
    let outcome: RunOutcome = {
      kind: 'failure',
      failure: { code: 'unknown', message: "Claude Code n'a pas renvoyé de proposition. Réessaie." }
    }
    createInterface({ input: child.stdout! }).on('line', (line) => {
      const event = parseStreamLine(line)
      if (event?.type === 'init' && !isPlanBilled(event.apiKeySource)) {
        outcome = { kind: 'failure', failure: NOT_ON_PLAN }
        child.kill('SIGKILL')
      } else if (event?.type === 'result') {
        outcome = { kind: 'result', result: event.result }
      }
    })
    child.stdin!.on('error', () => undefined)
    child.stdin!.end(input)
    child.on('error', () => {
      outcome = { kind: 'failure', failure: CLI_MISSING }
    })
    child.on('close', () => {
      clearTimeout(timer)
      resolve(outcome)
    })
  })
}

export async function generateViaClaudeCode(description: string): Promise<Result<AgentDraft>> {
  const binary = findBinary()
  if (!binary) return { ok: false, message: CLI_MISSING.message }

  const args = structuredArgs(GENERATION_INSTRUCTIONS, GENERATION_MODEL, 'low', z.toJSONSchema(GeneratedAgentSchema))
  const outcome = await runToResult(binary, args, description)
  if (outcome.kind === 'failure') return { ok: false, message: outcome.failure.message }
  const { result } = outcome
  const failure = classifyResult(result)
  if (failure) return { ok: false, message: failure.message }

  const parsed = GeneratedAgentSchema.safeParse(result.structuredOutput)
  if (!parsed.success) return { ok: false, message: 'La proposition reçue était incomplète. Réessaie.' }
  try {
    return { ok: true, value: normalizeGenerated(parsed.data) }
  } catch {
    return { ok: false, message: 'La proposition reçue était incomplète. Réessaie.' }
  }
}

const NOT_INSTALLED: SubscriptionStatus = { installed: false, loggedIn: false, billedToPlan: false, plan: null }

export async function subscriptionStatus(): Promise<SubscriptionStatus> {
  const binary = findBinary()
  if (!binary) return NOT_INSTALLED
  const output = await collect(binary, ['auth', 'status'], null, STATUS_TIMEOUT_MS)
  if (!output) return NOT_INSTALLED
  try {
    const data = JSON.parse(output.stdout) as Record<string, unknown>
    const loggedIn = data['loggedIn'] === true
    const method = typeof data['authMethod'] === 'string' ? data['authMethod'] : ''
    return {
      installed: true,
      loggedIn,
      billedToPlan: loggedIn && !/console|api/i.test(method),
      plan: typeof data['subscriptionType'] === 'string' ? data['subscriptionType'] : null
    }
  } catch {
    return { installed: true, loggedIn: false, billedToPlan: false, plan: null }
  }
}

/** Ouvre la page de connexion officielle dans le navigateur. L'app ne voit jamais les identifiants. */
export async function loginToSubscription(): Promise<Result<SubscriptionStatus>> {
  const binary = findBinary()
  if (!binary) return { ok: false, message: CLI_MISSING.message }
  const output = await collect(binary, ['auth', 'login', '--claudeai'], null, 10 * 60_000)
  const status = await subscriptionStatus()
  if (status.loggedIn) return { ok: true, value: status }
  return {
    ok: false,
    message: output
      ? 'La connexion n\'a pas abouti. Réessaie, ou lance « claude auth login » dans un terminal.'
      : "Impossible de lancer la connexion. Lance « claude auth login » dans un terminal."
  }
}
