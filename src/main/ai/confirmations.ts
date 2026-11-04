import { randomUUID } from 'node:crypto'
import { classifyToolCall, parseConnectorTool, type Confirmation, type ConfirmationOutcome } from '../../shared/connectors'

export interface Decision {
  decision: 'allow' | 'deny'
  reason: string
}

export interface RunHandlers {
  /** Clé de chaque connecteur de ce tour, et son nom pour l'affichage. */
  labels: Record<string, string>
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
      const parsed = parseConnectorTool(name)
      const connector = parsed ? run.labels[parsed.key] : undefined
      if (!parsed || !connector) return denied("Ce connecteur n'est pas activé pour cet agent.")
      if (classifyToolCall(parsed.tool, input) === 'read') {
        return { decision: Promise.resolve({ decision: 'allow', reason: 'Lecture.' }), cancel: () => undefined }
      }

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
              : { decision: 'deny', reason: REFUSALS[outcome] }
          )
        }
        pending.set(id, { runId, settle })
      })
      run.onConfirm({ id, connector, tool: parsed.tool, input })
      return { decision, cancel: () => settle('cancelled') }
    },

    answer(id: string, approved: boolean): void {
      pending.get(id)?.settle(approved ? 'approved' : 'refused')
    }
  }
}
