import { connectorKey } from '../../shared/connectors'
import type { AgentTools } from '../../shared/tools'

/**
 * Contrôle exécuté par Claude Code avant chaque appel d'outil, en mode abonnement.
 * Il tient la liste de domaines, que les règles de Claude Code ne peuvent pas
 * imposer à la recherche, et demande à l'app sa décision sur chaque appel de
 * connecteur. Toute erreur sort avec le code 2, qui bloque l'appel. Si le contrôle
 * ne répond pas du tout, Claude Code refuse aussi : rien ne lui donne d'autorisation.
 */
export const TOOL_GUARD_SCRIPT = `'use strict'
const fs = require('node:fs')
const net = require('node:net')

function decide(permissionDecision, permissionDecisionReason, updatedInput) {
  const hookSpecificOutput = { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason }
  if (updatedInput) hookSpecificOutput.updatedInput = updatedInput
  process.stdout.write(JSON.stringify({ hookSpecificOutput }))
}

function fail() {
  process.stderr.write("Le contrôle des outils a échoué : l'appel est bloqué.")
  process.exit(2)
}

function askApp(bridge, tool, input) {
  let answer = ''
  let answered = false
  const socket = net.createConnection(bridge.socket)
  socket.setEncoding('utf8')
  socket.on('connect', () => socket.write(JSON.stringify({ runId: bridge.runId, tool, input }) + '\\n'))
  socket.on('error', fail)
  socket.on('data', (chunk) => {
    answer += chunk
    const end = answer.indexOf('\\n')
    if (end === -1 || answered) return
    answered = true
    try {
      const { decision, reason } = JSON.parse(answer.slice(0, end))
      decide(decision === 'allow' ? 'allow' : 'deny', String(reason))
      socket.end()
    } catch {
      fail()
    }
  })
  socket.on('close', () => {
    if (!answered) fail()
  })
}

try {
  const policy = JSON.parse(Buffer.from(process.argv[2], 'base64').toString('utf8'))
  const call = JSON.parse(fs.readFileSync(0, 'utf8'))
  const domains = policy.allowedDomains
  const input = call.tool_input || {}

  if (call.tool_name.startsWith('mcp__') && policy.bridge) {
    askApp(policy.bridge, call.tool_name, input)
  } else if (call.tool_name === 'WebSearch' && policy.webSearch) {
    if (domains.length === 0) {
      decide('allow', 'Recherche sans filtre.')
    } else {
      // La liste de l'agent remplace ce que le modèle a demandé.
      const { blocked_domains: _ignored, ...rest } = input
      decide('allow', 'Recherche limitée aux domaines autorisés.', { ...rest, allowed_domains: domains })
    }
  } else if (call.tool_name === 'WebFetch' && policy.webFetch) {
    const url = new URL(input.url)
    const host = url.hostname.toLowerCase().replace(/\\.$/, '')
    const webUrl = url.protocol === 'https:' || url.protocol === 'http:'
    const allowed = domains.length === 0 || domains.some((domain) => host === domain || host.endsWith('.' + domain))
    if (webUrl && allowed) decide('allow', 'Domaine autorisé.')
    else decide('deny', 'Ce domaine ne fait pas partie de ceux autorisés pour cet agent : ' + host)
  } else {
    decide('deny', "Cet outil n'est pas activé pour cet agent.")
  }
} catch {
  fail()
}
`

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** Plus long que l'attente d'une confirmation, pour que l'app reste celle qui décide. */
const GUARD_TIMEOUT_SECONDS = 330

export interface ToolArgs {
  tools: string
  settings: string
  mcpConfig: string | null
}

export interface ResolvedConnector {
  name: string
  url: string
  token: string | null
}

export interface ConnectorConfig {
  mcpConfig: string | null
  /** Les jetons passent par l'environnement : ils n'apparaissent pas sur la ligne de commande. */
  env: Record<string, string>
  labels: Record<string, string>
}

export function connectorConfig(connectors: ResolvedConnector[]): ConnectorConfig {
  if (connectors.length === 0) return { mcpConfig: null, env: {}, labels: {} }
  const mcpServers: Record<string, unknown> = {}
  const env: Record<string, string> = {}
  const labels: Record<string, string> = {}
  connectors.forEach((connector, index) => {
    const key = connectorKey(connector.name, Object.keys(labels))
    labels[key] = connector.name
    const variable = `AT_MCP_TOKEN_${index}`
    if (connector.token) env[variable] = connector.token
    mcpServers[key] = {
      type: 'http',
      url: connector.url,
      ...(connector.token ? { headers: { Authorization: `Bearer \${${variable}}` } } : {})
    }
  })
  return { mcpConfig: JSON.stringify({ mcpServers }), env, labels }
}

/** Options de Claude Code pour un agent à outils. Le contrôle tourne sur le Node intégré à Electron. */
export function toolGuardArgs(
  tools: AgentTools,
  mcpConfig: string | null,
  bridge: { socket: string; runId: string } | null,
  runtimePath: string,
  scriptPath: string
): ToolArgs {
  const names = [...(tools.webSearch ? ['WebSearch'] : []), ...(tools.webFetch ? ['WebFetch'] : [])]
  const { webSearch, webFetch, allowedDomains } = tools
  const policy = Buffer.from(JSON.stringify({ webSearch, webFetch, allowedDomains, bridge })).toString('base64')
  const command = `ELECTRON_RUN_AS_NODE=1 ${shellQuote(runtimePath)} ${shellQuote(scriptPath)} ${shellQuote(policy)}`
  return {
    tools: names.join(','),
    mcpConfig,
    settings: JSON.stringify({
      hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command, timeout: GUARD_TIMEOUT_SECONDS }] }] }
    })
  }
}
