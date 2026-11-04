import type Anthropic from '@anthropic-ai/sdk'
import { describeToolUse, type AgentTools, type ToolActivity } from '../../shared/tools'

type BetaTool = Anthropic.Beta.Messages.BetaToolUnion
type StreamEvent = Anthropic.Beta.Messages.BetaRawMessageStreamEvent

// Bornes par tour, pour garder le coût prévisible : la recherche est facturée à l'unité.
const MAX_SEARCHES = 5
const MAX_FETCHES = 5
const MAX_FETCHED_TOKENS = 20_000

/**
 * Outils serveur de l'API, pour le mode clé API. Les versions de base appellent
 * les outils directement, sans exécution de code, et fonctionnent sur les trois modèles.
 */
export function webTools(tools: AgentTools): BetaTool[] {
  const filter = tools.allowedDomains.length > 0 ? { allowed_domains: tools.allowedDomains } : {}
  return [
    ...(tools.webSearch
      ? [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: MAX_SEARCHES, ...filter }]
      : []),
    ...(tools.webFetch
      ? [
          {
            type: 'web_fetch_20250910' as const,
            name: 'web_fetch' as const,
            max_uses: MAX_FETCHES,
            max_content_tokens: MAX_FETCHED_TOKENS,
            ...filter
          }
        ]
      : [])
  ]
}

export interface Source {
  url: string
  title: string
}

export interface ServerToolTracker {
  /** Lit un événement du flux. Renvoie ce que fait l'agent quand un appel d'outil est complet. */
  push(event: StreamEvent): ToolActivity | null
  sources(): Source[]
}

/** Suit les appels d'outils serveur et les sources citées au fil du flux. */
export function createServerToolTracker(): ServerToolTracker {
  const pending = new Map<number, { name: string; json: string }>()
  const sources = new Map<string, string>()

  function addSource(url: unknown, title: unknown): void {
    if (typeof url === 'string' && /^https?:\/\//.test(url) && !sources.has(url)) {
      sources.set(url, typeof title === 'string' && title ? title : url)
    }
  }

  return {
    push(event) {
      if (event.type === 'content_block_start') {
        const block = event.content_block
        if (block.type === 'server_tool_use') pending.set(event.index, { name: block.name, json: '' })
        if (block.type === 'web_fetch_tool_result' && block.content.type === 'web_fetch_result') {
          addSource(block.content.url, block.content.content.title)
        }
      } else if (event.type === 'content_block_delta') {
        const { delta } = event
        if (delta.type === 'input_json_delta') {
          const call = pending.get(event.index)
          if (call) call.json += delta.partial_json
        } else if (delta.type === 'citations_delta' && delta.citation.type === 'web_search_result_location') {
          addSource(delta.citation.url, delta.citation.title)
        }
      } else if (event.type === 'content_block_stop') {
        const call = pending.get(event.index)
        if (call) {
          pending.delete(event.index)
          try {
            return describeToolUse(call.name, JSON.parse(call.json))
          } catch {
            return null
          }
        }
      }
      return null
    },
    sources: () => [...sources].map(([url, title]) => ({ url, title }))
  }
}

/** Liste à ajouter à la réponse : uniquement les sources que l'agent n'a pas déjà citées. */
export function sourcesFooter(sources: Source[], visibleText: string): string {
  const missing = sources.filter((source) => !visibleText.includes(source.url))
  if (missing.length === 0) return ''
  const lines = missing.map(({ url, title }) => `- [${title.replace(/[[\]]/g, '')}](${url})`)
  return `\n\nSources :\n${lines.join('\n')}`
}
