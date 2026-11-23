import { nativeImage } from 'electron'
import { z } from 'zod'
import {
  attachmentKind,
  attachmentProblem,
  MAX_ATTACHMENTS,
  MAX_NAME_LENGTH,
  type AttachmentKind,
  type AttachmentMeta
} from '../../shared/attachments'

/** Bloc de contenu au format de l'API, accepté tel quel par Claude Code en entrée `stream-json`. */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string }; title: string }

export interface PreparedAttachment {
  meta: AttachmentMeta
  block: ContentBlock
}

/** Message de la personne : son texte (éventuellement vide) et ses pièces jointes. */
export interface OutgoingMessage {
  text: string
  attachments: PreparedAttachment[]
}

/** Côté le plus long recommandé par l'API : au-delà, l'image est réduite côté serveur, et facturée pour rien. */
const MAX_IMAGE_SIDE = 1568
/** Limite de l'API par image, avec une marge pour l'encodage base64. */
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024

const AttachmentsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
      data: z.instanceof(Uint8Array)
    })
  )
  .max(MAX_ATTACHMENTS)

const startsWith = (data: Uint8Array, bytes: number[], offset = 0): boolean =>
  bytes.every((byte, index) => data[offset + index] === byte)

/** Type réel d'une image d'après ses premiers octets : le nom seul ne suffit pas. */
function imageMediaType(data: Uint8Array): string | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(data, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return null
}

/** Réduit une image trop grande ou trop lourde. `null` : illisible. */
function fitImage(data: Uint8Array, mediaType: string): { mediaType: string; data: Buffer } | null {
  const buffer = Buffer.from(data)
  let image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) {
    // Format que macOS ne décode pas ici : on l'envoie tel quel s'il respecte la limite.
    return buffer.length <= MAX_IMAGE_BYTES ? { mediaType, data: buffer } : null
  }
  const { width, height } = image.getSize()
  const tooBig = Math.max(width, height) > MAX_IMAGE_SIDE
  if (!tooBig && buffer.length <= MAX_IMAGE_BYTES) return { mediaType, data: buffer }
  if (tooBig) {
    const scale = MAX_IMAGE_SIDE / Math.max(width, height)
    image = image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' })
  }
  // Le PNG garde la netteté du texte d'une capture ; le JPEG sert si le PNG reste trop lourd.
  const png = image.toPNG()
  if (png.length <= MAX_IMAGE_BYTES) return { mediaType: 'image/png', data: png }
  const jpeg = image.toJPEG(85)
  return jpeg.length <= MAX_IMAGE_BYTES ? { mediaType: 'image/jpeg', data: jpeg } : null
}

/** Texte brut en UTF-8, sans octet nul. `null` : fichier binaire. */
function decodeText(data: Uint8Array): string | null {
  if (data.includes(0)) return null
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    return null
  }
}

/** Échappe le nom pour qu'il ne puisse pas fermer la balise qui l'entoure. */
const safeName = (name: string): string => name.replace(/[<>"\n\r]/g, '_')

function prepareOne(name: string, data: Uint8Array): PreparedAttachment | string {
  const problem = attachmentProblem(name, data.length)
  if (problem) return problem
  const kind = attachmentKind(name) as AttachmentKind
  const meta = { name, kind }
  const unreadable = `« ${name} » ne correspond pas à son type ou est illisible.`

  if (kind === 'image') {
    const mediaType = imageMediaType(data)
    if (!mediaType) return unreadable
    const fitted = fitImage(data, mediaType)
    if (!fitted) return `« ${name} » est trop lourde, même réduite.`
    return { meta, block: { type: 'image', source: { type: 'base64', media_type: fitted.mediaType, data: fitted.data.toString('base64') } } }
  }
  if (kind === 'pdf') {
    if (!startsWith(data, [0x25, 0x50, 0x44, 0x46])) return unreadable
    return {
      meta,
      block: { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(data).toString('base64') }, title: name }
    }
  }
  const text = decodeText(data)
  if (text === null) return unreadable
  return { meta, block: { type: 'text', text: `<fichier nom="${safeName(name)}">\n${text}\n</fichier>` } }
}

/** Valide et prépare les pièces jointes reçues du renderer. Le premier problème rencontré arrête tout. */
export function prepareAttachments(raw: unknown): { ok: true; value: PreparedAttachment[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) return { ok: true, value: [] }
  const parsed = AttachmentsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, message: `Pièces jointes refusées : ${MAX_ATTACHMENTS} fichiers au maximum.` }
  const prepared: PreparedAttachment[] = []
  for (const { name, data } of parsed.data) {
    const result = prepareOne(name, data)
    if (typeof result === 'string') return { ok: false, message: result }
    prepared.push(result)
  }
  return { ok: true, value: prepared }
}

/** Contenu d'un message : les pièces jointes d'abord, la question ensuite, comme le recommande l'API. */
export function userContent(text: string, attachments: PreparedAttachment[]): ContentBlock[] {
  const question = text || 'Voici des pièces jointes.'
  return [...attachments.map((attachment) => attachment.block), { type: 'text', text: question }]
}
