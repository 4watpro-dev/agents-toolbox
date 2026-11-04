import type { ConfirmationOutcome } from '../../../shared/connectors'
import type { ChatAction } from './chatState'

const OUTCOMES: Record<ConfirmationOutcome, string> = {
  approved: 'Action confirmée',
  refused: 'Action refusée',
  expired: 'Sans réponse à temps : action non exécutée',
  cancelled: 'Action annulée : non exécutée'
}

function displayValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

/** Paramètres de l'action, affichés en entier : c'est sur eux que porte la décision. */
function details(input: unknown): [string, string][] {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return Object.entries(input).map(([key, value]) => [key, displayValue(value)])
  }
  return input === undefined || input === null ? [] : [['valeur', displayValue(input)]]
}

interface ActionCardProps {
  action: ChatAction
  agentName: string
  onAnswer(approved: boolean): void
}

export function ActionCard({ action, agentName, onAnswer }: ActionCardProps): React.JSX.Element {
  if (action.outcome) {
    return (
      <p className={`chat-waiting action-outcome action-outcome-${action.outcome}`}>
        {OUTCOMES[action.outcome]} : {action.connector}, {action.tool}
      </p>
    )
  }
  const rows = details(action.input)
  return (
    <section className="action-card" role="group" aria-label={`Action à confirmer : ${action.tool}`}>
      <h2>{agentName} veut effectuer cette action</h2>
      <p className="action-target">
        {action.connector} : <code>{action.tool}</code>
      </p>
      {rows.length > 0 ? (
        <dl className="action-details">
          {rows.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="field-hint">Aucun paramètre.</p>
      )}
      <p className="field-hint">Rien ne s'exécute sans ton accord.</p>
      <div className="action-buttons">
        <button type="button" className="button" onClick={() => onAnswer(false)}>
          Refuser
        </button>
        <button type="button" className="button button-primary" onClick={() => onAnswer(true)}>
          Confirmer
        </button>
      </div>
    </section>
  )
}
