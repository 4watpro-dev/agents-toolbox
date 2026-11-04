import type { ToolboxApi } from '../shared/ipc'

declare global {
  interface Window {
    toolbox: ToolboxApi
  }
}
