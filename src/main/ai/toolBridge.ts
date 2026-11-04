import { randomUUID } from 'node:crypto'
import { chmodSync, rmSync } from 'node:fs'
import { createServer, type Server, type Socket } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'
import { createConfirmationBroker, type Decision, type RunHandlers } from './confirmations'

/** Laisse le temps de revenir au chat, sans laisser une action attendre indéfiniment. */
export const CONFIRMATION_TIMEOUT_MS = 5 * 60_000
const MAX_REQUEST_BYTES = 2_000_000

const broker = createConfirmationBroker(CONFIRMATION_TIMEOUT_MS)
let server: Server | null = null
let socketPath: string | null = null

function handle(socket: Socket): void {
  let buffer = ''
  let cancel: (() => void) | null = null
  const reply = (decision: Decision): void => {
    cancel = null
    socket.end(`${JSON.stringify(decision)}\n`)
  }

  socket.setEncoding('utf8')
  socket.on('error', () => undefined)
  socket.on('close', () => cancel?.())
  socket.on('data', (chunk: string) => {
    if (cancel) return
    buffer += chunk
    if (buffer.length > MAX_REQUEST_BYTES) {
      reply({ decision: 'deny', reason: 'Demande trop volumineuse.' })
      return
    }
    const end = buffer.indexOf('\n')
    if (end === -1) return
    try {
      const { runId, tool, input } = JSON.parse(buffer.slice(0, end)) as { runId: unknown; tool: unknown; input: unknown }
      if (typeof runId !== 'string' || typeof tool !== 'string') throw new Error('demande invalide')
      const pending = broker.request(runId, tool, input)
      cancel = pending.cancel
      void pending.decision.then(reply)
    } catch {
      reply({ decision: 'deny', reason: 'Demande illisible.' })
    }
  })
}

/** Canal local entre le contrôle exécuté par Claude Code et l'app, réservé à l'utilisateur du Mac. */
function bridgeSocket(): string {
  if (socketPath) return socketPath
  const path = join(app.getPath('temp'), `agent-toolbox-${randomUUID().slice(0, 8)}.sock`)
  server = createServer(handle)
  server.listen(path, () => chmodSync(path, 0o600))
  socketPath = path
  return path
}

export function openToolRun(handlers: RunHandlers): { socket: string; runId: string; close(): void } {
  const runId = broker.openRun(handlers)
  return { socket: bridgeSocket(), runId, close: () => broker.closeRun(runId) }
}

export function answerConfirmation(id: string, approved: boolean): void {
  broker.answer(id, approved)
}

export function closeToolBridge(): void {
  server?.close()
  if (socketPath) rmSync(socketPath, { force: true })
  server = null
  socketPath = null
}
