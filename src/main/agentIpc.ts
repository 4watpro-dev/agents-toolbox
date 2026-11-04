import { ipcMain } from 'electron'
import { z } from 'zod'
import { AgentDraftSchema } from '../shared/agent'
import { DEFAULT_AVATAR, type AvatarConfig } from '../shared/avatar'
import { IPC } from '../shared/ipc'
import { listAgents, removeAgent, saveAgent, setFavorite } from './store/agents'
import { deleteAgentData } from './store/conversations'
import { getSettings, updateSettings } from './store/settings'
import { sendWidgetAvatar } from './windows'

const IdSchema = z.string().min(1)

/** Avatar de l'icône : dernier agent utilisé, ou à défaut le premier de la liste. */
function widgetAvatar(): AvatarConfig {
  const agents = listAgents()
  const agent = agents.find(({ id }) => id === getSettings().lastAgentId) ?? agents[0]
  return agent?.avatar ?? DEFAULT_AVATAR
}

export function registerAgentIpc(): void {
  ipcMain.handle(IPC.widgetGetAvatar, () => widgetAvatar())
  ipcMain.handle(IPC.agentsList, () => listAgents())

  ipcMain.handle(IPC.agentsSave, (_event, id: unknown, draft: unknown) => {
    const agent = saveAgent(IdSchema.nullable().parse(id), AgentDraftSchema.parse(draft))
    sendWidgetAvatar(widgetAvatar())
    return agent
  })

  ipcMain.handle(IPC.agentsSetFavorite, (_event, id: unknown, isFavorite: unknown) =>
    setFavorite(IdSchema.parse(id), z.boolean().parse(isFavorite))
  )

  ipcMain.handle(IPC.agentsRemove, (_event, id: unknown) => {
    const agentId = IdSchema.parse(id)
    removeAgent(agentId)
    deleteAgentData(agentId)
    if (getSettings().lastAgentId === agentId) updateSettings({ lastAgentId: null })
    sendWidgetAvatar(widgetAvatar())
  })

  ipcMain.handle(IPC.agentsMarkUsed, (_event, id: unknown) => {
    updateSettings({ lastAgentId: IdSchema.parse(id) })
    sendWidgetAvatar(widgetAvatar())
  })
}
