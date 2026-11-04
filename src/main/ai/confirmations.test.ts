import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Confirmation } from '../../shared/connectors'
import { createConfirmationBroker } from './confirmations'

function setup() {
  const broker = createConfirmationBroker(1000)
  const shown: Confirmation[] = []
  const resolved: [string, string][] = []
  const runId = broker.openRun({
    labels: { brevo: 'Brevo' },
    onConfirm: (confirmation) => shown.push(confirmation),
    onResolved: (id, outcome) => resolved.push([id, outcome])
  })
  return { broker, runId, shown, resolved }
}

describe('createConfirmationBroker', () => {
  beforeEach(() => void vi.useFakeTimers())
  afterEach(() => void vi.useRealTimers())

  it('laisse passer une lecture sans carte', async () => {
    const { broker, runId, shown } = setup()
    expect((await broker.request(runId, 'mcp__brevo__get_stats', {}).decision).decision).toBe('allow')
    expect(shown).toEqual([])
  })

  it("n'autorise une écriture qu'après le clic sur Confirmer", async () => {
    const { broker, runId, shown, resolved } = setup()
    let settled = false
    const { decision } = broker.request(runId, 'mcp__brevo__send_campaign', { name: 'Noël' })
    void decision.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(900)
    expect(settled).toBe(false)
    expect(shown[0]).toMatchObject({ connector: 'Brevo', tool: 'send_campaign', input: { name: 'Noël' } })
    broker.answer(shown[0].id, true)
    expect((await decision).decision).toBe('allow')
    expect(resolved).toEqual([[shown[0].id, 'approved']])
  })

  it('refuse sur Refuser', async () => {
    const { broker, runId, shown } = setup()
    const { decision } = broker.request(runId, 'mcp__brevo__delete_contact', {})
    broker.answer(shown[0].id, false)
    expect(await decision).toMatchObject({ decision: 'deny', reason: 'La personne a refusé cette action.' })
  })

  it('refuse à la fin du délai, et un clic tardif ne change rien', async () => {
    const { broker, runId, shown, resolved } = setup()
    const { decision } = broker.request(runId, 'mcp__brevo__delete_contact', {})
    await vi.advanceTimersByTimeAsync(1000)
    expect((await decision).decision).toBe('deny')
    broker.answer(shown[0].id, true)
    expect(resolved).toEqual([[shown[0].id, 'expired']])
  })

  it('refuse tout ce qui attend quand le tour se termine', async () => {
    const { broker, runId } = setup()
    const { decision } = broker.request(runId, 'mcp__brevo__send_campaign', {})
    broker.closeRun(runId)
    expect((await decision).decision).toBe('deny')
    expect((await broker.request(runId, 'mcp__brevo__get_stats', {}).decision).decision).toBe('deny')
  })

  it("refuse si le contrôle s'est interrompu", async () => {
    const { broker, runId } = setup()
    const { decision, cancel } = broker.request(runId, 'mcp__brevo__send_campaign', {})
    cancel()
    expect((await decision).decision).toBe('deny')
  })

  it("refuse un tour inconnu, un connecteur non activé ou un autre outil", async () => {
    const { broker, runId } = setup()
    expect((await broker.request('inconnu', 'mcp__brevo__get_stats', {}).decision).decision).toBe('deny')
    expect((await broker.request(runId, 'mcp__autre__get_stats', {}).decision).decision).toBe('deny')
    expect((await broker.request(runId, 'Bash', {}).decision).decision).toBe('deny')
  })

  it('une confirmation ne vaut que pour son propre appel', async () => {
    const { broker, runId, shown } = setup()
    const first = broker.request(runId, 'mcp__brevo__send_campaign', { name: 'A' })
    const second = broker.request(runId, 'mcp__brevo__send_campaign', { name: 'B' })
    broker.answer(shown[0].id, true)
    expect((await first.decision).decision).toBe('allow')
    let settled = false
    void second.decision.then(() => (settled = true))
    await vi.advanceTimersByTimeAsync(500)
    expect(settled).toBe(false)
    broker.answer(shown[1].id, false)
    expect((await second.decision).decision).toBe('deny')
  })
})
