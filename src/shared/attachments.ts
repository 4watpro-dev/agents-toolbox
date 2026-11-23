// Importé par le preload (types seulement) et par le renderer : aucune dépendance à l'exécution.

export type AttachmentKind = 'image' | 'pdf' | 'text'

/** Fichier joint à un message, tel que le renderer l'envoie au main. */
export interface AttachmentInput {
  name: string
  data: Uint8Array
}

/** Ce que l'historique garde d'une pièce jointe : son nom, jamais son contenu. */
export interface AttachmentMeta {
  name: string
  kind: AttachmentKind
}

export const MAX_ATTACHMENTS = 5
export const MAX_NAME_LENGTH = 200

/** Limites par fichier, avant réduction des images. */
export const MAX_BYTES: Record<AttachmentKind, number> = {
  image: 20 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  text: 500 * 1024
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'log',
  'html', 'htm', 'css', 'scss', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs',
  'java', 'kt', 'swift', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sql', 'sh', 'zsh', 'vue', 'svelte'
]

/** Pour le sélecteur de fichiers. */
export const ACCEPTED_EXTENSIONS = [...IMAGE_EXTENSIONS, 'pdf', ...TEXT_EXTENSIONS].map((ext) => `.${ext}`).join(',')

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** Type d'une pièce jointe d'après son nom. `null` : non pris en charge. */
export function attachmentKind(name: string): AttachmentKind | null {
  const extension = extensionOf(name)
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image'
  if (extension === 'pdf') return 'pdf'
  if (TEXT_EXTENSIONS.includes(extension)) return 'text'
  return null
}

/** Raison d'un refus, ou `null` si le fichier peut être joint. */
export function attachmentProblem(name: string, size: number): string | null {
  const kind = attachmentKind(name)
  if (!kind) return `« ${name} » : type de fichier non pris en charge (images, PDF et fichiers texte uniquement).`
  if (size === 0) return `« ${name} » est vide.`
  if (size > MAX_BYTES[kind]) {
    const limit = MAX_BYTES[kind] >= 1024 * 1024 ? `${MAX_BYTES[kind] / 1024 / 1024} Mo` : `${MAX_BYTES[kind] / 1024} Ko`
    return `« ${name} » est trop lourd (${limit} maximum).`
  }
  return null
}

/** Mention d'une pièce jointe là où seul le texte est conservé (historique, reprise de conversation). */
export function attachmentsNote(attachments: AttachmentMeta[] | undefined): string {
  if (!attachments || attachments.length === 0) return ''
  return `[Pièces jointes : ${attachments.map((attachment) => attachment.name).join(', ')}]`
}

/** Texte d'un message, sa mention de pièces jointes comprise. */
export function textWithAttachments(text: string, attachments: AttachmentMeta[] | undefined): string {
  const note = attachmentsNote(attachments)
  if (!note) return text
  return text ? `${note}\n${text}` : note
}
