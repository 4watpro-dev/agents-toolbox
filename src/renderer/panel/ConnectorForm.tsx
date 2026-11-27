import { useState, type KeyboardEvent } from 'react'
import type { Connector } from '../../shared/connectors'

interface ConnectorFormProps {
  /** `null` : ajout d'un connecteur. */
  editing: Connector | null
  onSaved(connector: Connector): void
  onCancel(): void
}

/**
 * Ajout ou modification d'un connecteur, dans les réglages comme dans la fiche d'un agent.
 * Le jeton part vers le process principal et n'en revient jamais.
 */
export function ConnectorForm({ editing, onSaved, onCancel }: ConnectorFormProps): React.JSX.Element {
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    url: editing?.url ?? '',
    token: '',
    tokenHeader: editing?.tokenHeader ?? '',
    readOnly: editing?.readOnly ?? false
  })
  const [advanced, setAdvanced] = useState(Boolean(editing?.tokenHeader))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(): Promise<void> {
    if (saving || !form.name.trim() || !form.url.trim()) return
    // En modification, un champ vide garde le jeton enregistré.
    const token = form.token.trim() || (editing ? null : '')
    setSaving(true)
    // Sans jeton, l'app interroge le serveur : s'il demande OAuth, « Se connecter » apparaît.
    const result = await window.toolbox.connectors.save(editing?.id ?? null, {
      name: form.name,
      url: form.url,
      token,
      tokenHeader: form.tokenHeader.trim() || null,
      readOnly: form.readOnly
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onSaved(result.value)
  }

  // Un bloc et non un <form> : dans la fiche d'un agent, il vit déjà dans un formulaire.
  // Entrée enregistre le connecteur, sans jamais soumettre la fiche autour.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    event.stopPropagation()
    void save()
  }

  return (
    <div className="connector-form" role="group" aria-label={editing ? `Modifier ${editing.name}` : 'Nouveau connecteur'} onKeyDown={onKeyDown}>
      <label className="field">
        <span className="field-label">Nom</span>
        <input className="input" maxLength={40} placeholder="Context7" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">Adresse du serveur</span>
        <input
          className="input"
          spellCheck={false}
          placeholder="https://mcp.context7.com/mcp"
          value={form.url}
          onChange={(event) => setForm({ ...form, url: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">Jeton (optionnel)</span>
        <input
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={editing?.hasToken ? 'Laisser vide pour garder le jeton' : 'Ta clé ou ton jeton'}
          value={form.token}
          onChange={(event) => setForm({ ...form, token: event.target.value })}
        />
        <span className="field-hint">
          Chiffré par le trousseau macOS. Laisse vide si le serveur propose une connexion OAuth : un bouton « Se connecter » apparaîtra.
        </span>
      </label>
      <div className="connector-readonly">
        <label className="tool-option">
          <input type="checkbox" checked={form.readOnly} onChange={(event) => setForm({ ...form, readOnly: event.target.checked })} />
          Connecteur en lecture seule : ne jamais demander de confirmation
        </label>
        <p className={form.readOnly ? 'connector-warning is-on' : 'connector-warning'}>
          À réserver aux services qui ne peuvent rien modifier, comme une documentation. Coché, aucun outil de ce connecteur ne
          t'est soumis : s'il savait envoyer, supprimer ou payer, l'agent le ferait sans te demander.
        </p>
      </div>
      <details className="connector-advanced" open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}>
        <summary>Options avancées</summary>
        <label className="field">
          <span className="field-label">En-tête du jeton</span>
          <input
            className="input"
            spellCheck={false}
            placeholder="Authorization (Bearer)"
            value={form.tokenHeader}
            onChange={(event) => setForm({ ...form, tokenHeader: event.target.value })}
          />
          <span className="field-hint">
            Vide : le jeton part en « Authorization: Bearer … ». Sinon, il est envoyé tel quel dans l'en-tête indiqué, par exemple
            CONTEXT7_API_KEY.
          </span>
        </label>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="connector-actions">
        <button type="button" className="button" onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className="button button-primary" disabled={saving || !form.name.trim() || !form.url.trim()} onClick={() => void save()}>
          {saving ? 'Vérification…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
