import { useEffect, useState } from 'react'
import type { Connector } from '../../shared/connectors'
import { ConnectorForm } from './ConnectorForm'

export function ConnectorSettings(): React.JSX.Element {
  const [connectors, setConnectors] = useState<Connector[]>([])
  /** `undefined` : formulaire fermé. `null` : ajout. */
  const [editing, setEditing] = useState<Connector | null | undefined>(undefined)
  const [removing, setRemoving] = useState<string | null>(null)
  /** Connecteur dont la connexion OAuth est en cours dans le navigateur. */
  const [signingIn, setSigningIn] = useState<string | null>(null)
  const [loginError, setLoginError] = useState<{ id: string; message: string } | null>(null)

  async function refresh(): Promise<void> {
    setConnectors(await window.toolbox.connectors.list())
  }

  useEffect(() => {
    void refresh()
  }, [])

  function open(connector: Connector | null): void {
    setEditing(connector)
  }

  async function login(id: string): Promise<void> {
    setSigningIn(id)
    setLoginError(null)
    const result = await window.toolbox.connectors.login(id)
    setSigningIn(null)
    if (!result.ok) setLoginError({ id, message: result.message })
    await refresh()
  }

  async function logout(id: string): Promise<void> {
    await window.toolbox.connectors.logout(id)
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
                {connector.auth === 'oauth' ? (
                  <span className={connector.connected ? 'connector-status is-on' : 'connector-status'}>
                    {signingIn === connector.id
                      ? 'Termine la connexion dans ton navigateur…'
                      : connector.connected
                        ? 'Connecté par OAuth, jetons chiffrés'
                        : 'Connexion requise'}
                  </span>
                ) : (
                  <span className="field-hint">
                    {connector.hasToken
                      ? `Jeton enregistré, chiffré${connector.tokenHeader ? `, envoyé dans ${connector.tokenHeader}` : ''}`
                      : 'Sans jeton'}
                  </span>
                )}
                {connector.readOnly && <span className="connector-status is-warning">Lecture seule : aucune confirmation</span>}
                {loginError?.id === connector.id && (
                  <span className="form-error" role="alert">
                    {loginError.message}
                  </span>
                )}
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
                  {connector.auth === 'token' && connector.hasToken && (
                    <button type="button" className="button" disabled={signingIn !== null} onClick={() => void logout(connector.id)}>
                      Se déconnecter
                    </button>
                  )}
                  {connector.auth === 'oauth' &&
                    (connector.connected ? (
                      <button type="button" className="button" disabled={signingIn !== null} onClick={() => void logout(connector.id)}>
                        Se déconnecter
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={signingIn !== null}
                        onClick={() => void login(connector.id)}
                      >
                        {signingIn === connector.id ? 'Connexion…' : 'Se connecter'}
                      </button>
                    ))}
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
        <ConnectorForm
          key={editing?.id ?? 'nouveau'}
          editing={editing}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            void refresh()
          }}
        />
      )}
    </section>
  )
}
