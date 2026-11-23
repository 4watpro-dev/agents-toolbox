import { contextBridge, ipcRenderer } from 'electron'
import type { AvatarConfig } from '../shared/avatar'
import type { ChatEvent } from '../shared/chat'
import { IPC, type PanelNavigation, type PanelState, type ToolboxApi } from '../shared/ipc'

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
    onAvatar: (listener) => subscribe<AvatarConfig>(IPC.widgetAvatar, listener),
    onBadge: (listener) => subscribe<boolean>(IPC.widgetBadge, listener)
  },
  panel: {
    onState: (listener) => subscribe<PanelState>(IPC.panelState, listener),
    painted: (requestedAt) => ipcRenderer.send(IPC.panelPainted, requestedAt),
    close: () => ipcRenderer.send(IPC.panelClose),
    onNavigate: (listener) => subscribe<PanelNavigation>(IPC.panelNavigate, listener)
  },
  palette: {
    onState: (listener) => subscribe<boolean>(IPC.paletteState, listener),
    resize: (height) => ipcRenderer.send(IPC.paletteResize, height),
    close: () => ipcRenderer.send(IPC.paletteClose),
    continueInPanel: (agentId, conversationId) => ipcRenderer.send(IPC.paletteContinue, agentId, conversationId)
  },
  conversations: {
    list: (agentId) => ipcRenderer.invoke(IPC.conversationsList, agentId),
    get: (agentId, id) => ipcRenderer.invoke(IPC.conversationsGet, agentId, id),
    remove: (agentId, id) => ipcRenderer.invoke(IPC.conversationsDelete, agentId, id),
    search: (query) => ipcRenderer.invoke(IPC.conversationsSearch, query),
    setPinned: (agentId, id, pinned) => ipcRenderer.invoke(IPC.conversationsSetPinned, agentId, id, pinned),
    exportMarkdown: (agentId, id) => ipcRenderer.invoke(IPC.conversationsExport, agentId, id)
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
    markUsed: (id) => ipcRenderer.invoke(IPC.agentsMarkUsed, id),
    lastUsed: () => ipcRenderer.invoke(IPC.agentsLastUsed),
    exportToFile: (id) => ipcRenderer.invoke(IPC.agentsExport, id),
    importFromFile: () => ipcRenderer.invoke(IPC.agentsImport)
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
    send: (sessionId, agent, text, agentId, attachments) =>
      ipcRenderer.send(IPC.chatSend, sessionId, agent, text, agentId, attachments ?? []),
    stop: (sessionId) => ipcRenderer.send(IPC.chatStop, sessionId),
    reset: (sessionId) => ipcRenderer.send(IPC.chatReset, sessionId),
    onEvent: (listener) => subscribe<ChatEvent>(IPC.chatEvent, listener),
    confirm: (id, approved) => ipcRenderer.send(IPC.chatConfirm, id, approved)
  },
  connectors: {
    list: () => ipcRenderer.invoke(IPC.connectorsList),
    save: (id, input) => ipcRenderer.invoke(IPC.connectorsSave, id, input),
    remove: (id) => ipcRenderer.invoke(IPC.connectorsRemove, id)
  },
  tasks: {
    list: (agentId) => ipcRenderer.invoke(IPC.tasksList, agentId),
    save: (id, input) => ipcRenderer.invoke(IPC.tasksSave, id, input),
    remove: (id) => ipcRenderer.invoke(IPC.tasksRemove, id),
    runNow: (id) => ipcRenderer.send(IPC.tasksRunNow, id),
    onChanged: (listener) => subscribe<void>(IPC.tasksChanged, listener)
  },
  generateAgent: (description) => ipcRenderer.invoke(IPC.generateAgent, description),
  chooseKnowledgeFolder: () => ipcRenderer.invoke(IPC.knowledgeChoose),
  copyText: (text) => ipcRenderer.send(IPC.copyText, text)
}

contextBridge.exposeInMainWorld('toolbox', api)
