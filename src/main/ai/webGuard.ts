import type { AgentTools } from '../../shared/tools'

/**
 * Contrôle exécuté par Claude Code avant chaque appel d'outil, en mode abonnement.
 * Ses règles de permission ne filtrent pas la recherche par domaine et laissent
 * passer une liste de sites préapprouvés : seul ce contrôle tient la liste de l'agent.
 * Toute erreur sort avec le code 2, qui bloque l'appel.
 */
export const WEB_GUARD_SCRIPT = `'use strict'
const fs = require('node:fs')

function decide(permissionDecision, permissionDecisionReason, updatedInput) {
  const hookSpecificOutput = { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason }
  if (updatedInput) hookSpecificOutput.updatedInput = updatedInput
  process.stdout.write(JSON.stringify({ hookSpecificOutput }))
}

try {
  const policy = JSON.parse(Buffer.from(process.argv[2], 'base64').toString('utf8'))
  const call = JSON.parse(fs.readFileSync(0, 'utf8'))
  const domains = policy.allowedDomains
  const input = call.tool_input || {}

  if (call.tool_name === 'WebSearch' && policy.webSearch) {
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
  process.stderr.write("Le contrôle des outils a échoué : l'appel est bloqué.")
  process.exit(2)
}
`

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

const GUARD_TIMEOUT_SECONDS = 30

/** Options de Claude Code pour un agent à outils web. Le contrôle tourne sur le Node intégré à Electron. */
export function webToolArgs(tools: AgentTools, runtimePath: string, scriptPath: string): { tools: string; settings: string } {
  const names = [...(tools.webSearch ? ['WebSearch'] : []), ...(tools.webFetch ? ['WebFetch'] : [])]
  const policy = Buffer.from(JSON.stringify(tools)).toString('base64')
  const command = `ELECTRON_RUN_AS_NODE=1 ${shellQuote(runtimePath)} ${shellQuote(scriptPath)} ${shellQuote(policy)}`
  return {
    tools: names.join(','),
    settings: JSON.stringify({
      hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command, timeout: GUARD_TIMEOUT_SECONDS }] }] }
    })
  }
}
