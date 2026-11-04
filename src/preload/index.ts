import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PanelState, type ToolboxApi } from '../shared/ipc'

const api: ToolboxApi = {
  widget: {
    click: (at) => ipcRenderer.send(IPC.widgetClick, at),
    dragStart: () => ipcRenderer.send(IPC.widgetDragStart),
    dragEnd: () => ipcRenderer.send(IPC.widgetDragEnd)
  },
  panel: {
    onState: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: PanelState): void => listener(state)
      ipcRenderer.on(IPC.panelState, handler)
      return () => ipcRenderer.removeListener(IPC.panelState, handler)
    },
    painted: (requestedAt) => ipcRenderer.send(IPC.panelPainted, requestedAt),
    close: () => ipcRenderer.send(IPC.panelClose)
  }
}

contextBridge.exposeInMainWorld('toolbox', api)
