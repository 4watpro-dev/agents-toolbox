import { readFile, stat, writeFile } from 'node:fs/promises'
import { dialog, ipcMain } from 'electron'
import { z } from 'zod'
import { parseAgentsFile, serializeAgents, uniqueName } from '../shared/agentTransfer'
import { IPC, type TransferResult } from '../shared/ipc'
import { listAgents, saveAgent } from './store/agents'
import { withPanelHidden } from './windows'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const CANCELED: TransferResult = { ok: true, value: { canceled: true, message: '' } }
const JSON_FILTER = [{ name: 'Agents (JSON)', extensions: ['json'] }]

const plural = (count: number): string => `${count} agent${count > 1 ? 's' : ''}`

async function exportAgents(agentId: string | null): Promise<TransferResult> {
  const agents = agentId ? listAgents().filter((agent) => agent.id === agentId) : listAgents()
  if (agents.length === 0) return { ok: false, message: 'Aucun agent à exporter.' }
  const defaultPath = agents.length === 1 ? `agent-${agents[0].name.replace(/[^\p{L}\p{N}-]+/gu, '-')}.json` : 'agents.json'
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath, filters: JSON_FILTER })
  if (canceled || !filePath) return CANCELED
  try {
    await writeFile(filePath, serializeAgents(agents))
  } catch {
    return { ok: false, message: "Impossible d'écrire ce fichier. Choisis un autre emplacement." }
  }
  return { ok: true, value: { canceled: false, message: `${plural(agents.length)} exporté${agents.length > 1 ? 's' : ''}, sans mémoire ni conversations.` } }
}

async function importAgents(): Promise<TransferResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: JSON_FILTER })
  if (canceled || !filePaths[0]) return CANCELED
  let content: string
  try {
    if ((await stat(filePaths[0])).size > MAX_FILE_BYTES) return { ok: false, message: 'Ce fichier est trop volumineux pour être un export d\'agents.' }
    content = await readFile(filePaths[0], 'utf8')
  } catch {
    return { ok: false, message: 'Impossible de lire ce fichier.' }
  }
  const parsed = parseAgentsFile(content)
  if (!parsed) return { ok: false, message: "Ce fichier n'est pas un export d'Agent Toolbox." }
  if (parsed.drafts.length === 0) return { ok: false, message: 'Aucune fiche valide dans ce fichier.' }
  for (const draft of parsed.drafts) {
    // Toujours un nouvel agent : un import n'écrase jamais une fiche existante.
    saveAgent(null, { ...draft, name: uniqueName(draft.name, listAgents().map((agent) => agent.name)) })
  }
  const skipped = parsed.skipped > 0 ? ` ${plural(parsed.skipped)} ignoré${parsed.skipped > 1 ? 's' : ''} : fiche invalide.` : ''
  return {
    ok: true,
    value: { canceled: false, message: `${plural(parsed.drafts.length)} importé${parsed.drafts.length > 1 ? 's' : ''}.${skipped}` }
  }
}

export function registerTransferIpc(): void {
  ipcMain.handle(IPC.agentsExport, (_event, agentId: unknown) =>
    withPanelHidden(() => exportAgents(z.uuid().nullable().parse(agentId)))
  )
  ipcMain.handle(IPC.agentsImport, () => withPanelHidden(importAgents))
}
