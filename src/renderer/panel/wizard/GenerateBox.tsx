import { useRef, useState } from 'react'
import type { AgentDraft } from '../../../shared/agent'

interface GenerateBoxProps {
  draft: AgentDraft
  onGenerated(draft: AgentDraft): void
}

export function GenerateBox({ draft, onGenerated }: GenerateBoxProps): React.JSX.Element {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previous, setPrevious] = useState<AgentDraft | null>(null)
  // Une demande annulée peut encore aboutir : son résultat doit alors être ignoré.
  const requestId = useRef(0)
  const field = useRef<HTMLTextAreaElement>(null)

  async function generate(): Promise<void> {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    setPrevious(null)
    const before = draft
    const result = await window.toolbox.generateAgent(description)
    if (id !== requestId.current) return
    setLoading(false)
    if (result.ok) {
      onGenerated(result.value)
      setPrevious(before)
    } else {
      setError(result.message)
    }
  }

  const canGenerate = description.trim() !== ''

  return (
    // Même rendu que sur la landing page : une carte, la phrase, et le bouton citron.
    <section className="generate">
      <textarea
        ref={field}
        className="generate-input"
        rows={2}
        maxLength={2000}
        aria-label="Décris l'agent à générer avec l'IA"
        placeholder="Un agent qui transforme mes notes en newsletter…"
        value={description}
        disabled={loading}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={(event) => {
          // ⌘↩ lance la génération sans quitter le clavier.
          if (event.key === 'Enter' && event.metaKey && canGenerate && !loading) {
            event.preventDefault()
            void generate()
          }
        }}
      />
      <div className="generate-actions">
        {loading ? (
          <>
            <span className="generate-pill is-loading" role="status">
              ✦ Création du personnage
              <span className="working-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </span>
            <button
              type="button"
              className="generate-link"
              onClick={() => {
                requestId.current++
                setLoading(false)
              }}
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="generate-pill"
              onClick={() => {
                // Toujours vif, comme sur la landing : sans description, il invite à en écrire une.
                if (canGenerate) void generate()
                else field.current?.focus()
              }}
            >
              ✦ Générer avec l’IA
            </button>
            {previous ? (
              <button
                type="button"
                className="generate-link"
                onClick={() => {
                  onGenerated(previous)
                  setPrevious(null)
                }}
              >
                Annuler le préremplissage
              </button>
            ) : (
              <span className="generate-hint">Préremplit les 4 étapes</span>
            )}
          </>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
