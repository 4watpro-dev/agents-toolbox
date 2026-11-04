// Importé par le preload, qui tourne en sandbox et ne peut charger aucun module
// npm : ce fichier ne doit avoir aucune dépendance à l'exécution. Les imports de
// types sont effacés à la compilation. Les schémas zod sont utilisés côté main.
import type { Agent, AgentDraft } from './agent'
import type { AvatarConfig } from './avatar'

export const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
export type Corner = (typeof CORNERS)[number]

export const IPC = {
  widgetClick: 'widget:click',
  widgetDragStart: 'widget:drag-start',
  widgetDragEnd: 'widget:drag-end',
  widgetGetAvatar: 'widget:get-avatar',
  widgetAvatar: 'widget:avatar',
  panelState: 'panel:state',
  panelPainted: 'panel:painted',
  panelClose: 'panel:close',
  agentsList: 'agents:list',
  agentsSave: 'agents:save',
  agentsRemove: 'agents:remove',
  agentsSetFavorite: 'agents:set-favorite',
  agentsMarkUsed: 'agents:mark-used'
} as const

export interface PanelState {
  open: boolean
  corner: Corner
  /** Horodatage de la demande d'ouverture, renvoyé au main pour mesurer le délai. */
  requestedAt: number
}

export interface WidgetApi {
  click(at: number): void
  dragStart(): void
  dragEnd(): void
  getAvatar(): Promise<AvatarConfig>
  onAvatar(listener: (avatar: AvatarConfig) => void): () => void
}

export interface PanelApi {
  onState(listener: (state: PanelState) => void): () => void
  painted(requestedAt: number): void
  close(): void
}

export interface AgentsApi {
  list(): Promise<Agent[]>
  /** `id` nul : crée un nouvel agent. */
  save(id: string | null, draft: AgentDraft): Promise<Agent>
  remove(id: string): Promise<void>
  setFavorite(id: string, isFavorite: boolean): Promise<Agent>
  markUsed(id: string): Promise<void>
}

export interface ToolboxApi {
  widget: WidgetApi
  panel: PanelApi
  agents: AgentsApi
}
