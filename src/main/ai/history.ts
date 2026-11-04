import type Anthropic from '@anthropic-ai/sdk'

type Block = Anthropic.Beta.Messages.BetaContentBlock
type BlockParam = Anthropic.Beta.Messages.BetaContentBlockParam

const INTERNAL_BLOCKS = new Set(['thinking', 'redacted_thinking', 'tool_use', 'server_tool_use'])

/**
 * Prépare une réponse à être renvoyée au tour suivant. Les blocs restent tels
 * quels, réflexion comprise. Seule exception, imposée par l'API : après un repli
 * en cours de réponse, les blocs internes antérieurs au repli sont retirés.
 */
export function toHistoryContent(content: Block[]): BlockParam[] {
  const lastFallback = content.map((block) => block.type as string).lastIndexOf('fallback')
  return content
    .filter((block, index) => {
      const type = block.type as string
      if (type === 'fallback') return false
      return !(index < lastFallback && INTERNAL_BLOCKS.has(type))
    }) as BlockParam[]
}
