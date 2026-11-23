import type { AttachmentKind } from '../../../shared/attachments'
import type { DisplayAttachment } from './chatState'

const KIND_ICONS: Record<AttachmentKind, string> = { image: '🖼', pdf: '📄', text: '📝' }

interface AttachmentListProps {
  attachments: DisplayAttachment[]
  /** Présent : chaque pièce jointe a un bouton pour la retirer. */
  onRemove?(index: number): void
}

export function AttachmentList({ attachments, onRemove }: AttachmentListProps): React.JSX.Element {
  return (
    <ul className="attachments" aria-label="Pièces jointes">
      {attachments.map((attachment, index) => (
        <li key={`${attachment.name}-${index}`} className="attachment" title={attachment.name}>
          {attachment.thumbnail ? (
            <img className="attachment-thumbnail" src={attachment.thumbnail} alt="" />
          ) : (
            <span className="attachment-icon" aria-hidden="true">
              {KIND_ICONS[attachment.kind]}
            </span>
          )}
          <span className="attachment-name">{attachment.name}</span>
          {onRemove && (
            <button
              type="button"
              className="attachment-remove"
              aria-label={`Retirer ${attachment.name}`}
              onClick={() => onRemove(index)}
            >
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
