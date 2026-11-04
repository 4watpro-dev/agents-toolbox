import { contextBridge, ipcRenderer } from 'electron'
import type { AvatarConfig } from '../shared/avatar'
import { IPC, type PanelState, type ToolboxApi } from '../shared/ipc'

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T): void => listener(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: ToolboxApi = {
  widget: {
    click: (at) => ipcRenderer.send(IPC.widgetClick, at),
    dragStart: () => ipcRenderer.send(IPC.widgetDragStart),
    dragEnd: () => ipcRenderer.send(IPC.widgetDragEnd),
    getAvatar: () => ipcRenderer.invoke(IPC.widgetGetAvatar),
    onAvatar: (listener) => subscribe<AvatarConfig>(IPC.widgetAvatar, listener)
  },
  panel: {
    onState: (listener) => subscribe<PanelState>(IPC.panelState, listener),
    painted: (requestedAt) => ipcRenderer.send(IPC.panelPainted, requestedAt),
    close: () => ipcRenderer.send(IPC.panelClose)
  },
  agents: {
    list: () => ipcRenderer.invoke(IPC.agentsList),
    save: (id, draft) => ipcRenderer.invoke(IPC.agentsSave, id, draft),
    remove: (id) => ipcRenderer.invoke(IPC.agentsRemove, id),
    setFavorite: (id, isFavorite) => ipcRenderer.invoke(IPC.agentsSetFavorite, id, isFavorite),
    markUsed: (id) => ipcRenderer.invoke(IPC.agentsMarkUsed, id)
  }
}

contextBridge.exposeInMainWorld('toolbox', api)
