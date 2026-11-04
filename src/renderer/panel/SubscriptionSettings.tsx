import { useCallback, useEffect, useState } from 'react'
import type { SubscriptionStatus } from '../../shared/ipc'

function describe(status: SubscriptionStatus): string {
  if (!status.installed) return "Claude Code est introuvable sur ce Mac. Installe-le pour utiliser ton abonnement."
  if (!status.loggedIn) return "Claude Code n'est pas connecté."
  if (!status.billedToPlan) {
    return "Attention : Claude Code est connecté avec un compte Console, facturé à l'usage. Les agents ne répondront pas tant qu'il n'est pas reconnecté avec ton abonnement."
  }
  return status.plan ? `Connecté à ton abonnement Claude (${status.plan}).` : 'Connecté à ton abonnement Claude.'
}

export function SubscriptionSettings({ panelOpen }: { panelOpen: boolean }): React.JSX.Element {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    void window.toolbox.connection.subscriptionStatus().then(setStatus)
  }, [])

  // La connexion se termine dans le navigateur : on revérifie au retour dans le panneau.
  useEffect(() => {
    if (panelOpen) refresh()
  }, [panelOpen, refresh])

  async function login(): Promise<void> {
    setLoggingIn(true)
    setError(null)
    const result = await window.toolbox.connection.login()
    setLoggingIn(false)
    if (result.ok) setStatus(result.value)
    else setError(result.message)
  }

  const needsLogin = status?.installed && (!status.loggedIn || !status.billedToPlan)

  return (
    <section className="settings-section">
      <p role="status">{status ? describe(status) : 'Vérification…'}</p>
      {needsLogin && (
        <button
          type="button"
          className="button button-primary settings-delete"
          disabled={loggingIn}
          onClick={() => void login()}
        >
          {loggingIn ? 'Termine dans ton navigateur…' : 'Se connecter'}
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="field-hint">
        La connexion se fait sur la page officielle de Claude : cette app ne voit jamais tes identifiants. Tes agents passent par Claude Code et partagent les limites de ton forfait avec Claude.
      </p>
      <p className="field-hint">
        Pour éviter tout frais, laisse les crédits d'usage désactivés dans ton compte Claude : c'est le seul cas où un dépassement serait facturé.
      </p>
    </section>
  )
}
