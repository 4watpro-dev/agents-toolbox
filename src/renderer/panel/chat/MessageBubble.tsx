import { Children, isValidElement, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { languageOf, suggestFileName } from '../../../shared/codeFiles'
import type { ExportFormat, TransferResult } from '../../../shared/ipc'
import { AttachmentList } from './AttachmentList'
import type { DisplayAttachment } from './chatState'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  text: string
  attachments?: DisplayAttachment[]
  /** Titre du document exporté. Absent : la réponse ne s'exporte pas. */
  exportTitle?: string
}

const REMARK_PLUGINS = [remarkGfm]
const FEEDBACK_MS = 1800

const EXPORT_LABELS: Record<ExportFormat, string> = { pdf: 'PDF', docx: 'Word', md: 'Markdown' }

/** Retour bref sur un bouton (« Copié », « Enregistré »), qui s'efface tout seul. */
function useFlash(): [string | null, (message: string) => void] {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [message])
  return [message, setMessage]
}

/** Bloc de code d'une réponse, avec sa langue, Copier et Enregistrer. */
function CodeBlock({ children, before }: { children?: ReactNode; before: string }): React.JSX.Element {
  const [flash, setFlash] = useFlash()
  const child = Children.toArray(children)[0]
  const props = isValidElement<{ className?: string; children?: ReactNode }>(child) ? child.props : {}
  const language = languageOf(props.className)
  const code = String(props.children ?? '').replace(/\n$/, '')

  async function save(): Promise<void> {
    const result = await window.toolbox.files.saveText({ name: suggestFileName(code, language, before), content: code })
    if (!result.ok) setFlash(result.message)
    else if (!result.value.canceled) setFlash('Enregistré')
  }

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-language">{language ?? 'texte'}</span>
        <span className="code-actions">
          {flash && <span className="code-flash">{flash}</span>}
          <button
            type="button"
            onClick={() => {
              window.toolbox.copyText(code)
              setFlash('Copié')
            }}
          >
            Copier
          </button>
          <button type="button" onClick={() => void save()}>
            Enregistrer
          </button>
        </span>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

// Un message terminé ne change plus : on ne recalcule que celui qui arrive.
export const MessageBubble = memo(function MessageBubble({ role, text, attachments, exportTitle }: MessageBubbleProps): React.JSX.Element {
  const [flash, setFlash] = useFlash()
  const [exporting, setExporting] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  // Chaque bloc de code reçoit le texte qui le précède, où l'agent annonce souvent le nom du fichier.
  const components = useMemo<Components>(
    () => ({
      pre: ({ node, children }) => {
        const start = node?.position?.start.offset ?? 0
        return <CodeBlock before={text.slice(Math.max(0, start - 300), start)}>{children}</CodeBlock>
      }
    }),
    [text]
  )

  async function exportAs(format: ExportFormat): Promise<void> {
    setExporting(false)
    const result: TransferResult = await window.toolbox.files.exportReply({
      format,
      title: exportTitle ?? 'Réponse',
      markdown: text,
      html: body.current?.innerHTML ?? ''
    })
    if (!result.ok) setFlash(result.message)
    else if (!result.value.canceled) setFlash(`Exporté en ${EXPORT_LABELS[format]}`)
  }

  return (
    <div className={`message message-${role}`}>
      {attachments && attachments.length > 0 && <AttachmentList attachments={attachments} />}
      {text && (
        <>
          <div className="message-body" ref={body}>
            {/* Le HTML brut n'est pas interprété : react-markdown l'affiche comme du texte. */}
            {role === 'assistant' ? (
              <Markdown remarkPlugins={REMARK_PLUGINS} components={components}>
                {text}
              </Markdown>
            ) : (
              text
            )}
          </div>
          <div className="message-actions">
            <button
              type="button"
              className="message-copy"
              aria-label="Copier ce message"
              onClick={() => {
                window.toolbox.copyText(text)
                setFlash('Copié')
              }}
            >
              Copier
            </button>
            {role === 'assistant' && exportTitle && (
              <>
                <button type="button" className="message-copy" aria-expanded={exporting} onClick={() => setExporting(!exporting)}>
                  Exporter
                </button>
                {exporting &&
                  (Object.keys(EXPORT_LABELS) as ExportFormat[]).map((format) => (
                    <button key={format} type="button" className="message-copy message-format" onClick={() => void exportAs(format)}>
                      {EXPORT_LABELS[format]}
                    </button>
                  ))}
              </>
            )}
            {flash && <span className="message-flash">{flash}</span>}
          </div>
        </>
      )}
    </div>
  )
})
