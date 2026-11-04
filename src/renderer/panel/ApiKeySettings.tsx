import { useEffect, useState } from 'react'

const CONSOLE_URL = 'https://platform.claude.com'

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; verified: boolean } | { kind: 'error'; message: string }

export function ApiKeySettings(): React.JSX.Element {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    void window.toolbox.key.isSet().then(setHasKey)
  }, [])

  async function save(): Promise<void> {
    setStatus({ kind: 'saving' })
    const result = await window.toolbox.key.save(key)
    if (result.ok) {
      setKey('')
      setHasKey(true)
      setStatus({ kind: 'saved', verified: result.value.verified })
    } else {
      setStatus({ kind: 'error', message: result.message })
    }
  }

  async function remove(): Promise<void> {
    await window.toolbox.key.remove()
    setHasKey(false)
    setConfirmingDelete(false)
    setStatus({ kind: 'idle' })
  }

  return (
    <section className="settings-section">
      <h2>Clé API Anthropic</h2>
      <p className="form-error">Avec une clé API, chaque message est facturé à l'usage.</p>
      <p className="field-hint">
        {hasKey === null ? '…' : hasKey ? 'Une clé est enregistrée, chiffrée grâce au trousseau macOS.' : 'Aucune clé enregistrée.'}
      </p>
      <form
        className="settings-key"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <input
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={hasKey ? 'Remplacer la clé' : 'Colle ta clé ici'}
          aria-label="Clé API Anthropic"
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <button type="submit" className="button button-primary" disabled={!key.trim() || status.kind === 'saving'}>
          {status.kind === 'saving' ? 'Vérification…' : 'Enregistrer'}
        </button>
      </form>
      {status.kind === 'saved' && (
        <p className="field-hint" role="status">
          {status.verified ? 'Clé vérifiée et enregistrée.' : 'Clé enregistrée, mais non vérifiée : pas de connexion.'}
        </p>
      )}
      {status.kind === 'error' && (
        <p className="form-error" role="alert">
          {status.message}
        </p>
      )}
      <p className="field-hint">
        Crée-la sur la <a href={CONSOLE_URL}>Console Claude</a>.
      </p>
      {hasKey &&
        (confirmingDelete ? (
          <div className="settings-confirm">
            <span>Supprimer la clé ?</span>
            <button type="button" className="button" onClick={() => setConfirmingDelete(false)}>
              Annuler
            </button>
            <button type="button" className="button button-danger" onClick={() => void remove()}>
              Supprimer
            </button>
          </div>
        ) : (
          <button type="button" className="button settings-delete" onClick={() => setConfirmingDelete(true)}>
            Supprimer la clé
          </button>
        ))}
    </section>
  )
}
