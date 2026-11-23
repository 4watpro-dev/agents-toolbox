import { textWithAttachments } from './attachments'
import type { Conversation } from './conversation'

/** Résultat de recherche : une conversation et l'extrait qui contient le texte cherché. */
export interface SearchHit {
  agentId: string
  conversationId: string
  title: string
  updatedAt: string
  pinned: boolean
  /** Extrait découpé autour de la première occurrence, pour la mettre en évidence. */
  snippet: { before: string; match: string; after: string }
  /** Nombre d'occurrences dans toute la conversation. */
  count: number
}

export const MIN_QUERY_LENGTH = 2
export const MAX_HITS = 30
const BEFORE = 40
const AFTER = 90

/**
 * Forme comparable d'un texte : minuscules, sans accents. Chaque caractère garde
 * sa position, pour que l'extrait se découpe dans le texte d'origine.
 */
export function fold(text: string): string {
  return Array.from(text, (char) => {
    const base = char.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    // Même longueur obligatoire : sinon les positions ne correspondraient plus au texte d'origine.
    return base.length === char.length ? base : char
  }).join('')
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + needle.length)) count++
  return count
}

function snippetAround(text: string, start: number, length: number): SearchHit['snippet'] {
  const flat = (value: string): string => value.replace(/\s+/g, ' ')
  const from = Math.max(0, start - BEFORE)
  const to = Math.min(text.length, start + length + AFTER)
  return {
    before: (from > 0 ? '…' : '') + flat(text.slice(from, start)).trimStart(),
    match: flat(text.slice(start, start + length)),
    after: flat(text.slice(start + length, to)).trimEnd() + (to < text.length ? '…' : '')
  }
}

/**
 * Cherche un texte dans le titre et les messages, sans tenir compte de la casse ni
 * des accents. Épinglées d'abord, puis les plus récentes ; au plus {@link MAX_HITS}.
 */
export function searchConversations(conversations: Conversation[], query: string): SearchHit[] {
  const needle = fold(query.trim())
  if (needle.length < MIN_QUERY_LENGTH) return []
  const hits: SearchHit[] = []
  for (const conversation of conversations) {
    let count = 0
    let snippet: SearchHit['snippet'] | null = null
    for (const turn of conversation.messages) {
      const text = textWithAttachments(turn.text, turn.attachments)
      const folded = fold(text)
      const found = countOccurrences(folded, needle)
      if (found === 0) continue
      count += found
      snippet ??= snippetAround(text, folded.indexOf(needle), needle.length)
    }
    // Trouvé seulement dans le titre : le titre sert d'extrait.
    const titleIndex = fold(conversation.title).indexOf(needle)
    if (!snippet && titleIndex !== -1) snippet = snippetAround(conversation.title, titleIndex, needle.length)
    if (!snippet) continue
    hits.push({
      agentId: conversation.agentId,
      conversationId: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      pinned: conversation.pinned,
      snippet,
      count: Math.max(count, 1)
    })
  }
  return hits
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_HITS)
}

const EXPORT_DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })

/** Conversation mise en forme pour un fichier Markdown lisible partout. */
export function conversationMarkdown(conversation: Conversation, agentName: string): string {
  const header = [
    `# ${conversation.title || 'Conversation'}`,
    '',
    `*Conversation avec ${agentName} · ${EXPORT_DATE.format(new Date(conversation.createdAt))}*`
  ]
  const turns = conversation.messages.map((turn) => {
    const author = turn.role === 'user' ? 'Toi' : agentName
    return `## ${author}\n\n${textWithAttachments(turn.text, turn.attachments).trim()}`
  })
  return `${[...header, '', ...turns.flatMap((turn) => [turn, ''])].join('\n').trimEnd()}\n`
}

/** Nom de fichier sûr, tiré du titre. */
export function exportFileName(title: string): string {
  const base = title
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'conversation'}.md`
}
