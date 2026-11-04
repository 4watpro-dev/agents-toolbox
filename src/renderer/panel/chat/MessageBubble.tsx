import { memo, useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  text: string
}

const REMARK_PLUGINS = [remarkGfm]
const COPIED_MS = 1400

// Un message terminé ne change plus : on ne recalcule que celui qui arrive.
export const MessageBubble = memo(function MessageBubble({ role, text }: MessageBubbleProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <div className={`message message-${role}`}>
      <div className="message-body">
        {/* Le HTML brut n'est pas interprété : react-markdown l'affiche comme du texte. */}
        {role === 'assistant' ? <Markdown remarkPlugins={REMARK_PLUGINS}>{text}</Markdown> : text}
      </div>
      <button
        type="button"
        className="message-copy"
        aria-label="Copier ce message"
        onClick={() => {
          window.toolbox.copyText(text)
          setCopied(true)
        }}
      >
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  )
})
