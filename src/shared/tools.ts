import { z } from 'zod'
import { parseConnectorTool } from './connectors'

/**
 * Nom de domaine nu, en ASCII : les caractères Unicode permettraient de contourner
 * le filtre avec un domaine d'apparence identique (а cyrillique dans аmazon.com).
 */
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/

export const MAX_ALLOWED_DOMAINS = 50

export const AgentToolsSchema = z.object({
  webSearch: z.boolean(),
  webFetch: z.boolean(),
  /** Vide : aucun filtre. Un domaine couvre aussi ses sous-domaines. */
  allowedDomains: z.array(z.string().regex(DOMAIN)).max(MAX_ALLOWED_DOMAINS),
  /** Identifiants des connecteurs MCP configurés dans les réglages. */
  connectors: z.array(z.uuid()).max(20).default([])
})

export type AgentTools = z.infer<typeof AgentToolsSchema>

export const NO_TOOLS: AgentTools = { webSearch: false, webFetch: false, allowedDomains: [], connectors: [] }

export function isValidDomain(domain: string): boolean {
  return DOMAIN.test(domain)
}

export function usesWebTools(tools: AgentTools): boolean {
  return tools.webSearch || tools.webFetch
}

/**
 * Lit une liste saisie à la main et ramène chaque entrée à son domaine. Une entrée
 * illisible est conservée telle quelle : ne pas la signaler reviendrait à élargir le filtre.
 */
export function parseDomains(text: string): string[] {
  const domains = text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((entry) =>
      entry
        .toLowerCase()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
        .replace(/[/?#].*$/, '')
        .replace(/^\*\./, '')
        .replace(/\.$/, '')
    )
    .filter(Boolean)
  return [...new Set(domains)]
}

export type ToolActivity =
  | { kind: 'search'; query: string }
  | { kind: 'fetch'; host: string }
  | { kind: 'connector'; connector: string; tool: string }

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/** Ce que fait l'agent, d'après son appel d'outil. Les noms diffèrent entre l'API et Claude Code. */
export function describeToolUse(name: string, input: unknown, connectorLabels: Record<string, string> = {}): ToolActivity | null {
  const connectorTool = parseConnectorTool(name)
  if (connectorTool) {
    const connector = connectorLabels[connectorTool.key]
    return connector ? { kind: 'connector', connector, tool: connectorTool.tool } : null
  }
  const fields = (input ?? {}) as Record<string, unknown>
  if ((name === 'web_search' || name === 'WebSearch') && typeof fields['query'] === 'string') {
    return { kind: 'search', query: fields['query'] }
  }
  if ((name === 'web_fetch' || name === 'WebFetch') && typeof fields['url'] === 'string') {
    const host = hostOf(fields['url'])
    return host ? { kind: 'fetch', host } : null
  }
  return null
}

const MAX_QUERY_LENGTH = 60

/** Ligne affichée dans le chat pendant que l'agent utilise un outil. */
export function activityLabel(agentName: string, activity: ToolActivity): string {
  if (activity.kind === 'fetch') return `${agentName} consulte ${activity.host}…`
  if (activity.kind === 'connector') return `${agentName} utilise ${activity.connector} (${activity.tool})…`
  const { query } = activity
  const short = query.length > MAX_QUERY_LENGTH ? `${query.slice(0, MAX_QUERY_LENGTH).trimEnd()}…` : query
  return `${agentName} cherche « ${short} »…`
}
