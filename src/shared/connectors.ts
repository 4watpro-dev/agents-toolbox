import { z } from 'zod'

function isAcceptableUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  // Un jeton dans l'adresse serait stocké en clair : il a son propre champ, chiffré.
  if (url.username || url.password || value.includes('$')) return false
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

/**
 * En-tête qui porte un jeton collé à la main. `null` : `Authorization: Bearer <jeton>`.
 * Sinon le jeton est envoyé tel quel dans cet en-tête (ex. `CONTEXT7_API_KEY`). Les en-têtes
 * gérés par le transport HTTP lui-même sont refusés.
 */
const RESERVED_HEADERS = new Set(['host', 'content-length', 'content-type', 'accept', 'connection', 'cookie', 'transfer-encoding', 'mcp-session-id', 'mcp-protocol-version'])
export const TokenHeaderSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
  .refine((name) => !RESERVED_HEADERS.has(name.toLowerCase()))
  .nullable()

export const ConnectorSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(40),
  url: z.string().trim().max(500).refine(isAcceptableUrl),
  /**
   * `token` : jeton collé à la main (ou aucun, pour un serveur ouvert).
   * `oauth` : le serveur a demandé une connexion OAuth ; l'app obtient et rafraîchit les jetons.
   */
  auth: z.enum(['token', 'oauth']).default('token'),
  tokenHeader: TokenHeaderSchema.default(null),
  /**
   * Lecture seule déclarée par la personne : aucun outil de ce connecteur ne demande de
   * confirmation, quel que soit son nom. Faux par défaut, y compris pour les connecteurs
   * enregistrés avant l'apparition de ce réglage.
   */
  readOnly: z.boolean().default(false)
})

export type StoredConnector = z.infer<typeof ConnectorSchema>

/** Ce que voit l'interface : les jetons restent dans le process principal. */
export interface Connector extends StoredConnector {
  hasToken: boolean
  /** Mode OAuth : une autorisation valide est enregistrée. */
  connected: boolean
}

export interface ConnectorInput {
  name: string
  url: string
  /** `null` : garde le jeton déjà enregistré. Vide : le retire. */
  token: string | null
  /** `null` : Authorization: Bearer. */
  tokenHeader: string | null
  /** Vrai : jamais de carte de confirmation pour ce connecteur. */
  readOnly: boolean
}

export const ConnectorInputSchema = z.object({
  name: ConnectorSchema.shape.name,
  url: ConnectorSchema.shape.url,
  token: z.string().trim().max(2000).nullable(),
  tokenHeader: z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? null : value), TokenHeaderSchema).default(null),
  readOnly: z.boolean().default(false)
})

// Toute action de cette liste passe par une confirmation, même si le nom contient aussi une lecture.
const WRITE_WORDS = new Set(
  `create add insert new post put patch update edit modify set change rename move merge upsert save write
  delete remove destroy drop purge clear archive send publish schedule import upload sync submit cancel
  enable disable activate deactivate pause resume block unblock subscribe unsubscribe duplicate copy clone
  run execute trigger start stop approve reject refund pay transfer invite assign revoke grant reset replace`.split(/\s+/)
)

const READ_WORDS = new Set(
  `get list read search find fetch query lookup stats statistics count describe show view check status
  report reports retrieve info details analytics`.split(/\s+/)
)

const PARAMETERS_NAMING_AN_ACTION = ['action', 'method', 'operation', 'verb', 'command', 'type']

function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Une action ne passe sans confirmation que si son nom dit clairement que c'est
 * une lecture. Tout ce qui est écriture, ou simplement inconnu, demande un clic.
 */
export function classifyToolCall(tool: string, input: unknown): 'read' | 'write' {
  const names = words(tool)
  if (names.some((word) => WRITE_WORDS.has(word))) return 'write'
  if (!names.some((word) => READ_WORDS.has(word))) return 'write'
  const fields = (input ?? {}) as Record<string, unknown>
  for (const parameter of PARAMETERS_NAMING_AN_ACTION) {
    const value = fields[parameter]
    if (typeof value === 'string' && words(value).some((word) => WRITE_WORDS.has(word))) return 'write'
  }
  return 'read'
}

export interface Confirmation {
  id: string
  connector: string
  tool: string
  input: unknown
  /** `web` : une page hors des domaines autorisés, que l'agent veut consulter. */
  kind?: 'connector' | 'web'
}

export type ConfirmationOutcome = 'approved' | 'refused' | 'expired' | 'cancelled'

/** Découpe `mcp__brevo__send_campaign`. */
export function parseConnectorTool(name: string): { key: string; tool: string } | null {
  const match = /^mcp__(.+?)__(.+)$/.exec(name)
  return match ? { key: match[1], tool: match[2] } : null
}

/** Clé d'un connecteur pour Claude Code. Elle compose le nom de ses outils. */
export function connectorKey(name: string, taken: Iterable<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'connecteur'
  const used = new Set(taken)
  if (!used.has(base)) return base
  let index = 2
  while (used.has(`${base}-${index}`)) index++
  return `${base}-${index}`
}
