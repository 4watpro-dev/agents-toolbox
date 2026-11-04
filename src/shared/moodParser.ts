export const MOODS = ['happy', 'surprised', 'confused', 'sorry', 'neutral'] as const
export type Mood = (typeof MOODS)[number]

const COMPLETE_TAG = /\[mood:([a-z]*)\]/gi
// Fin de texte pouvant être le début d'une balise : on attend la suite avant d'afficher.
const PARTIAL_TAG = /\[(?:m(?:o(?:o(?:d(?::[a-z]*)?)?)?)?)?$/i

function isMood(value: string): value is Mood {
  return (MOODS as readonly string[]).includes(value)
}

export interface MoodParser {
  /** Reçoit un fragment du flux et renvoie le texte affichable à ce stade. */
  push(chunk: string): string
  /** Fin du flux : renvoie le texte encore retenu et l'humeur trouvée. */
  finish(): { text: string; mood: Mood }
}

export function createMoodParser(): MoodParser {
  let buffer = ''
  let mood: Mood = 'neutral'

  function extractTags(): void {
    buffer = buffer.replace(COMPLETE_TAG, (_tag, value: string) => {
      const candidate = value.toLowerCase()
      if (isMood(candidate)) mood = candidate
      return ''
    })
  }

  return {
    push(chunk) {
      buffer += chunk
      extractTags()
      const partial = buffer.match(PARTIAL_TAG)
      const tagStart = partial?.index ?? buffer.length
      // Les espaces de fin sont retenus aussi : ceux qui précèdent la balise ne
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
      return { text, mood }
    }
  }
}
