export const MOODS = ['happy', 'surprised', 'confused', 'sorry', 'neutral'] as const
export type Mood = (typeof MOODS)[number]

const COMPLETE_TAG = /\[(mood|remember):([^\]\n]*)\]/gi
// Fin de texte pouvant être le début d'une balise : on attend la suite avant d'afficher.
const PARTIAL_TAG =
  /\[(?:m(?:o(?:o(?:d(?::[^\]\n]*)?)?)?)?|r(?:e(?:m(?:e(?:m(?:b(?:e(?:r(?::[^\]\n]*)?)?)?)?)?)?)?)?)?$/i

function isMood(value: string): value is Mood {
  return (MOODS as readonly string[]).includes(value)
}

export interface ParsedReply {
  text: string
  mood: Mood
  /** Faits que l'agent a demandé à retenir. */
  facts: string[]
}

export interface ReplyParser {
  /** Reçoit un fragment du flux et renvoie le texte affichable à ce stade. */
  push(chunk: string): string
  /** Fin du flux : renvoie le texte encore retenu, l'humeur et les faits trouvés. */
  finish(): ParsedReply
}

export function createReplyParser(): ReplyParser {
  let buffer = ''
  let mood: Mood = 'neutral'
  const facts: string[] = []

  function extractTags(): void {
    buffer = buffer.replace(COMPLETE_TAG, (_tag, kind: string, value: string) => {
      if (kind.toLowerCase() === 'mood') {
        const candidate = value.trim().toLowerCase()
        if (isMood(candidate)) mood = candidate
      } else if (value.trim()) {
        facts.push(value.trim())
      }
      return ''
    })
  }

  return {
    push(chunk) {
      buffer += chunk
      extractTags()
      const partial = buffer.match(PARTIAL_TAG)
      const tagStart = partial?.index ?? buffer.length
      // Les espaces de fin sont retenus aussi : ceux qui précèdent une balise ne
      // doivent pas laisser une ligne vide à la fin de la réponse.
      const head = buffer.slice(0, tagStart)
      const visibleEnd = head.trimEnd().length
      const visible = buffer.slice(0, visibleEnd)
      buffer = buffer.slice(visibleEnd)
      return visible
    },
    finish() {
      extractTags()
      const text = buffer.trimEnd()
      buffer = ''
      return { text, mood, facts }
    }
  }
}
