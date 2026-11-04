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

  return (
    <section className="generate">
      <label className="field">
        <span className="field-label">Générer avec l'IA</span>
        <textarea
          className="input"
          rows={2}
          maxLength={2000}
          placeholder="ex. : un ancien marin bourru qui m'aide à rédiger mes e-mails"
          value={description}
          disabled={loading}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="generate-actions">
        {loading ? (
          <>
            <span className="field-hint" role="status">
              Création du personnage…
            </span>
            <button
              type="button"
              className="button"
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
            {previous ? (
              <button
                type="button"
                className="button"
                onClick={() => {
                  onGenerated(previous)
                  setPrevious(null)
                }}
              >
                Annuler le préremplissage
              </button>
            ) : (
              <span className="field-hint">Préremplit les 4 étapes.</span>
            )}
            <button type="button" className="button" disabled={!description.trim()} onClick={() => void generate()}>
              Générer
            </button>
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
