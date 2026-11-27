import { randomUUID } from 'node:crypto'
import { classifyToolCall, parseConnectorTool, type Confirmation, type ConfirmationOutcome } from '../../shared/connectors'

export interface Decision {
  decision: 'allow' | 'deny'
  reason: string
}

export interface RunHandlers {
  /** Clé de chaque connecteur de ce tour, et son nom pour l'affichage. */
  labels: Record<string, string>
  /** Clés des connecteurs déclarés en lecture seule par la personne : jamais de carte. */
  readOnly?: string[]
  /** Une page hors des domaines autorisés peut être proposée à la personne. Sinon, refusée. */
  confirmWeb?: boolean
  onConfirm(confirmation: Confirmation): void
  onResolved(id: string, outcome: ConfirmationOutcome): void
}

export interface PendingRequest {
  decision: Promise<Decision>
  /** Le contrôle s'est interrompu : personne n'attend plus la réponse. */
  cancel(): void
}

const REFUSALS: Record<Exclude<ConfirmationOutcome, 'approved'>, string> = {
  refused: 'La personne a refusé cette action.',
  expired: "La personne n'a pas répondu à temps : l'action n'a pas été exécutée.",
  cancelled: "L'action a été annulée : elle n'a pas été exécutée."
}

const WEB_REFUSALS: Record<Exclude<ConfirmationOutcome, 'approved'>, string> = {
  refused: 'La personne a refusé que tu consultes cette page.',
  expired: "La personne n'a pas répondu à temps : la page n'a pas été consultée.",
  cancelled: "La demande a été annulée : la page n'a pas été consultée."
}

const OUTSIDE_DOMAINS =
  "Cette page est hors des domaines autorisés pour cet agent, et personne n'est là pour confirmer : elle n'a pas été consultée."

/** Adresse web lisible, ou `null`. */
function webUrl(input: unknown): URL | null {
  const raw = input && typeof input === 'object' ? (input as { url?: unknown }).url : undefined
  if (typeof raw !== 'string') return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

const denied = (reason: string): PendingRequest => ({ decision: Promise.resolve({ decision: 'deny', reason }), cancel: () => undefined })

/**
 * Tient la décision sur chaque appel de connecteur. Une action qui n'est pas une
 * lecture attend ici un clic : seul `answer(id, true)` peut produire un « allow ».
 */
export function createConfirmationBroker(timeoutMs: number) {
  const runs = new Map<string, RunHandlers>()
  const pending = new Map<string, { runId: string; settle(outcome: ConfirmationOutcome): void }>()

  return {
    openRun(handlers: RunHandlers): string {
      const runId = randomUUID()
      runs.set(runId, handlers)
      return runId
    },

    /** Fin du tour : tout ce qui attendait encore est refusé. */
    closeRun(runId: string): void {
      for (const entry of [...pending.values()]) {
        if (entry.runId === runId) entry.settle('cancelled')
      }
      runs.delete(runId)
    },

    request(runId: string, name: string, input: unknown): PendingRequest {
      const run = runs.get(runId)
      if (!run) return denied("Ce tour de conversation n'est plus actif.")
      if (name === 'WebFetch') {
        if (!run.confirmWeb) return denied(OUTSIDE_DOMAINS)
        const url = webUrl(input)
        if (!url) return denied('Adresse invalide : seules les pages http et https peuvent être consultées.')
        return ask(run, runId, { connector: 'Web', tool: url.hostname, input: { adresse: url.href }, kind: 'web' })
      }
      const parsed = parseConnectorTool(name)
      const connector = parsed ? run.labels[parsed.key] : undefined
      if (!parsed || !connector) return denied("Ce connecteur n'est pas activé pour cet agent.")
      // Choix explicite de la personne : on ne devine plus rien d'après le nom de l'outil.
      if (run.readOnly?.includes(parsed.key)) {
        return { decision: Promise.resolve({ decision: 'allow', reason: 'Connecteur en lecture seule.' }), cancel: () => undefined }
      }
      if (classifyToolCall(parsed.tool, input) === 'read') {
        return { decision: Promise.resolve({ decision: 'allow', reason: 'Lecture.' }), cancel: () => undefined }
      }
      return ask(run, runId, { connector, tool: parsed.tool, input, kind: 'connector' })
    },

    answer(id: string, approved: boolean): void {
      pending.get(id)?.settle(approved ? 'approved' : 'refused')
    }
  }

  /** Montre la carte et attend le clic : seul « Confirmer » produit un « allow ». */
  function ask(run: RunHandlers, runId: string, card: Omit<Confirmation, 'id'>): PendingRequest {
    const id = randomUUID()
    let settle: (outcome: ConfirmationOutcome) => void = () => undefined
    const decision = new Promise<Decision>((resolve) => {
      const timer = setTimeout(() => settle('expired'), timeoutMs)
      settle = (outcome) => {
        if (!pending.delete(id)) return
        clearTimeout(timer)
        run.onResolved(id, outcome)
        resolve(
          outcome === 'approved'
            ? { decision: 'allow', reason: 'Confirmé par la personne.' }
            : { decision: 'deny', reason: card.kind === 'web' ? WEB_REFUSALS[outcome] : REFUSALS[outcome] }
        )
      }
      pending.set(id, { runId, settle })
    })
    run.onConfirm({ id, ...card })
    return { decision, cancel: () => settle('cancelled') }
  }
}
