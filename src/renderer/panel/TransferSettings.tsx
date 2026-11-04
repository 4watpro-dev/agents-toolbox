import { useState } from 'react'
import type { TransferResult } from '../../shared/ipc'

interface TransferSettingsProps {
  /** Prévient le panneau qu'il doit recharger la liste après un import. */
  onImported(): void
}

export function TransferSettings({ onImported }: TransferSettingsProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ error: boolean; message: string } | null>(null)

  async function run(action: () => Promise<TransferResult>, afterSuccess?: () => void): Promise<void> {
    setBusy(true)
    setOutcome(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) {
      setOutcome({ error: true, message: result.message })
    } else if (!result.value.canceled) {
      setOutcome({ error: false, message: result.value.message })
      afterSuccess?.()
    }
  }

  return (
    <section className="settings-section">
      <h2>Sauvegarder mes agents</h2>
      <p className="field-hint">Le fichier contient leur fiche et leur prompt, sans mémoire ni conversations. Un import ajoute des agents sans jamais remplacer les tiens.</p>
      <div className="settings-actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void run(() => window.toolbox.agents.exportToFile(null))}
        >
          Exporter tous mes agents
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void run(() => window.toolbox.agents.importFromFile(), onImported)}
        >
          Importer
        </button>
      </div>
      {outcome && (
        <p className={outcome.error ? 'form-error' : 'field-hint'} role={outcome.error ? 'alert' : 'status'}>
          {outcome.message}
        </p>
      )}
    </section>
  )
}
