import { useEffect, useState } from 'react'
import type { Provider } from '../../shared/ipc'
import { ApiKeySettings } from './ApiKeySettings'
import { ConnectorSettings } from './ConnectorSettings'
import { PreferenceSettings } from './PreferenceSettings'
import { SubscriptionSettings } from './SubscriptionSettings'
import { TransferSettings } from './TransferSettings'

interface SettingsViewProps {
  panelOpen: boolean
  onBack(): void
  onAgentsChanged(): void
}

const PROVIDER_LABELS: Record<Provider, string> = {
  subscription: 'Mon abonnement Claude',
  api: "Clé API (payant à l'usage)"
}

export function SettingsView({ panelOpen, onBack, onAgentsChanged }: SettingsViewProps): React.JSX.Element {
  const [provider, setProvider] = useState<Provider | null>(null)

  useEffect(() => {
    void window.toolbox.connection.getProvider().then(setProvider)
  }, [])

  function choose(next: Provider): void {
    setProvider(next)
    void window.toolbox.connection.setProvider(next)
  }

  return (
    <div className="view">
      <header className="view-header">
        <button type="button" className="button-back" onClick={onBack} aria-label="Retour">
          ‹
        </button>
        <h1>Réglages</h1>
      </header>
      <div className="view-body wizard-body">
        <fieldset className="options">
          <legend className="field-label">Connexion à Claude</legend>
          <div className="chips chips-wrap">
            {(Object.keys(PROVIDER_LABELS) as Provider[]).map((option) => (
              <button
                key={option}
                type="button"
                className="chip"
                aria-pressed={provider === option}
                onClick={() => choose(option)}
              >
                {PROVIDER_LABELS[option]}
              </button>
            ))}
          </div>
        </fieldset>
        {provider === 'subscription' && <SubscriptionSettings panelOpen={panelOpen} />}
        {provider === 'api' && <ApiKeySettings />}
        <ConnectorSettings />
        <PreferenceSettings panelOpen={panelOpen} />
        <TransferSettings onImported={onAgentsChanged} />
      </div>
    </div>
  )
}
