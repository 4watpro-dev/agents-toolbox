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
    close: () => ipcRenderer.send(IPC.panelClose),
    onNavigate: (listener) => subscribe<'settings'>(IPC.panelNavigate, listener)
  },
  conversations: {
    list: (agentId) => ipcRenderer.invoke(IPC.conversationsList, agentId),
    get: (agentId, id) => ipcRenderer.invoke(IPC.conversationsGet, agentId, id),
    remove: (agentId, id) => ipcRenderer.invoke(IPC.conversationsDelete, agentId, id)
  },
  memory: {
    get: (agentId) => ipcRenderer.invoke(IPC.memoryGet, agentId),
    set: (agentId, facts) => ipcRenderer.invoke(IPC.memorySet, agentId, facts)
  },
  preferences: {
    getShortcut: () => ipcRenderer.invoke(IPC.shortcutGet),
    setShortcut: (accelerator) => ipcRenderer.invoke(IPC.shortcutSet, accelerator),
    suspendShortcut: () => ipcRenderer.send(IPC.shortcutSuspend),
    resumeShortcut: () => ipcRenderer.send(IPC.shortcutResume),
    getLoginItem: () => ipcRenderer.invoke(IPC.loginItemGet),
    setLoginItem: (enabled) => ipcRenderer.invoke(IPC.loginItemSet, enabled)
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
    send: (sessionId, agent, text, agentId) => ipcRenderer.send(IPC.chatSend, sessionId, agent, text, agentId),
    stop: (sessionId) => ipcRenderer.send(IPC.chatStop, sessionId),
    reset: (sessionId) => ipcRenderer.send(IPC.chatReset, sessionId),
    onEvent: (listener) => subscribe<ChatEvent>(IPC.chatEvent, listener)
  },
  generateAgent: (description) => ipcRenderer.invoke(IPC.generateAgent, description),
  copyText: (text) => ipcRenderer.send(IPC.copyText, text)
}

contextBridge.exposeInMainWorld('toolbox', api)
