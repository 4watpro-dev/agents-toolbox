import { contextBridge, ipcRenderer } from 'electron'
import type { AvatarConfig } from '../shared/avatar'
import type { ChatEvent } from '../shared/chat'
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
  },
  key: {
    isSet: () => ipcRenderer.invoke(IPC.keyStatus),
    save: (key) => ipcRenderer.invoke(IPC.keySave, key),
    remove: () => ipcRenderer.invoke(IPC.keyDelete)
  },
  connection: {
    getProvider: () => ipcRenderer.invoke(IPC.providerGet),
    setProvider: (provider) => ipcRenderer.invoke(IPC.providerSet, provider),
    subscriptionStatus: () => ipcRenderer.invoke(IPC.subscriptionStatus),
    login: () => ipcRenderer.invoke(IPC.subscriptionLogin)
  },
  chat: {
    send: (sessionId, agent, text) => ipcRenderer.send(IPC.chatSend, sessionId, agent, text),
    stop: (sessionId) => ipcRenderer.send(IPC.chatStop, sessionId),
    reset: (sessionId) => ipcRenderer.send(IPC.chatReset, sessionId),
    onEvent: (listener) => subscribe<ChatEvent>(IPC.chatEvent, listener)
  },
  generateAgent: (description) => ipcRenderer.invoke(IPC.generateAgent, description),
  copyText: (text) => ipcRenderer.send(IPC.copyText, text)
}

contextBridge.exposeInMainWorld('toolbox', api)
