import { useEffect, useState, type FormEvent } from 'react'
import type { Connector } from '../../shared/connectors'

const EMPTY_FORM = { name: '', url: '', token: '' }

export function ConnectorSettings(): React.JSX.Element {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  /** `undefined` : formulaire fermé. `null` : ajout. */
  const [editing, setEditing] = useState<Connector | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    setConnectors(await window.toolbox.connectors.list())
  }

  useEffect(() => {
    void refresh()
  }, [])

  function open(connector: Connector | null): void {
    setEditing(connector)
    setError(null)
    setForm(connector ? { name: connector.name, url: connector.url, token: '' } : EMPTY_FORM)
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault()
    // En modification, un champ vide garde le jeton enregistré.
    const token = form.token.trim() || (editing ? null : '')
    const result = await window.toolbox.connectors.save(editing?.id ?? null, { name: form.name, url: form.url, token })
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEditing(undefined)
    setForm(EMPTY_FORM)
    await refresh()
  }

  async function remove(id: string): Promise<void> {
    await window.toolbox.connectors.remove(id)
    setRemoving(null)
    await refresh()
  }

  return (
    <section className="settings-section">
      <h2>Connecteurs MCP</h2>
      <p>
        Serveurs distants que tes agents peuvent utiliser, à activer agent par agent. Les lectures passent directement. Toute autre action demande ton clic dans le chat.
      </p>
      <p className="field-hint">
        Ajoute uniquement des serveurs de confiance : l'app reconnaît une lecture au nom de l'action, et un serveur qui nommerait mal ses actions pourrait la tromper. Disponible seulement avec ton abonnement.
      </p>
      {connectors.length > 0 && (
        <ul className="connector-list">
          {connectors.map((connector) => (
            <li key={connector.id}>
              <div className="connector-info">
                <strong>{connector.name}</strong>
                <span className="field-hint">{connector.url}</span>
                <span className="field-hint">{connector.hasToken ? 'Jeton enregistré, chiffré' : 'Sans jeton'}</span>
              </div>
              {removing === connector.id ? (
                <div className="connector-actions">
                  <button type="button" className="button" onClick={() => setRemoving(null)}>
                    Garder
                  </button>
                  <button type="button" className="button" onClick={() => void remove(connector.id)}>
                    Confirmer
                  </button>
                </div>
              ) : (
                <div className="connector-actions">
                  <button type="button" className="button" onClick={() => open(connector)}>
                    Modifier
                  </button>
                  <button type="button" className="button" onClick={() => setRemoving(connector.id)}>
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing === undefined ? (
        <button type="button" className="button" onClick={() => open(null)}>
          + Ajouter un connecteur
        </button>
      ) : (
        <form className="connector-form" onSubmit={(event) => void save(event)}>
          <label className="field">
            <span className="field-label">Nom</span>
            <input className="input" maxLength={40} placeholder="Brevo" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Adresse du serveur</span>
            <input
              className="input"
              spellCheck={false}
              placeholder="https://mcp.brevo.com/v1/brevo/mcp"
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
              placeholder={editing?.hasToken ? 'Laisser vide pour garder le jeton' : 'Envoyé en Authorization: Bearer'}
              value={form.token}
              onChange={(event) => setForm({ ...form, token: event.target.value })}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="connector-actions">
            <button type="button" className="button" onClick={() => setEditing(undefined)}>
              Annuler
            </button>
            <button type="submit" className="button button-primary" disabled={!form.name.trim() || !form.url.trim()}>
              Enregistrer
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
