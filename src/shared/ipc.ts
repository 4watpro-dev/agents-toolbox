// Importé par le preload, qui tourne en sandbox et ne peut charger aucun module
// npm : ce fichier ne doit dépendre de rien. Les schémas zod vivent côté main.

export const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
export type Corner = (typeof CORNERS)[number]

export const IPC = {
  widgetClick: 'widget:click',
  widgetDragStart: 'widget:drag-start',
  widgetDragEnd: 'widget:drag-end',
  panelState: 'panel:state',
  panelPainted: 'panel:painted',
  panelClose: 'panel:close'
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
}

export interface PanelApi {
  onState(listener: (state: PanelState) => void): () => void
  painted(requestedAt: number): void
  close(): void
}

export interface ToolboxApi {
  widget: WidgetApi
  panel: PanelApi
}
