import {
  attachmentKind,
  attachmentProblem,
  MAX_ATTACHMENTS,
  type AttachmentInput
} from '../../../shared/attachments'
import type { DisplayAttachment } from './chatState'

/** Pièce jointe prête à partir, affichée au-dessus du champ de saisie. */
export interface PendingAttachment extends DisplayAttachment {
  id: string
  data: Uint8Array
}

const THUMBNAIL_SIZE = 96

/** Vignette en `data:` (la politique de sécurité du panneau refuse les URL `blob:`). */
async function thumbnail(file: Blob): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}

/** Une image collée depuis le presse-papiers s'appelle souvent « image.png » : on la renomme. */
function displayName(file: File, pasted: boolean): string {
  if (pasted && /^image\.(png|jpe?g|gif|webp)$/i.test(file.name)) {
    const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '.')
    return `Image collée ${time}.${file.name.split('.').pop()}`
  }
  return file.name
}

/**
 * Lit les fichiers déposés, choisis ou collés. Ceux qui ne passent pas sont
 * écartés avec leur raison ; les autres s'ajoutent jusqu'à la limite.
 */
export async function readAttachments(
  files: File[],
  alreadyPending: number,
  pasted = false
): Promise<{ added: PendingAttachment[]; problems: string[] }> {
  const added: PendingAttachment[] = []
  const problems: string[] = []
  for (const file of files) {
    const name = displayName(file, pasted)
    if (alreadyPending + added.length >= MAX_ATTACHMENTS) {
      problems.push(`${MAX_ATTACHMENTS} pièces jointes au maximum par message.`)
      break
    }
    const problem = attachmentProblem(name, file.size)
    if (problem) {
      problems.push(problem)
      continue
    }
    const kind = attachmentKind(name)!
    added.push({
      id: crypto.randomUUID(),
      name,
      kind,
      data: new Uint8Array(await file.arrayBuffer()),
      ...(kind === 'image' ? { thumbnail: await thumbnail(file) } : {})
    })
  }
  return { added, problems }
}

export function toSendable(pending: PendingAttachment[]): { inputs: AttachmentInput[]; display: DisplayAttachment[] } {
  return {
    inputs: pending.map(({ name, data }) => ({ name, data })),
    display: pending.map(({ name, kind, thumbnail }) => ({ name, kind, ...(thumbnail ? { thumbnail } : {}) }))
  }
}
