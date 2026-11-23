// Importé par le preload, qui tourne en sandbox et ne peut charger aucun module
// npm : ce fichier ne doit avoir aucune dépendance à l'exécution. Les imports de
// types sont effacés à la compilation. Les schémas zod sont utilisés côté main.
import type { Agent, AgentDraft } from './agent'
import type { AttachmentInput } from './attachments'
import type { AvatarConfig } from './avatar'
import type { ChatEvent } from './chat'
import type { Connector, ConnectorInput } from './connectors'
import type { Conversation, ConversationSummary } from './conversation'
import type { SearchHit } from './history'

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
  panelNavigate: 'panel:navigate',
  paletteState: 'palette:state',
  paletteResize: 'palette:resize',
  paletteClose: 'palette:close',
  paletteContinue: 'palette:continue',
  agentsLastUsed: 'agents:last-used',
  conversationsList: 'conversations:list',
  conversationsGet: 'conversations:get',
  conversationsDelete: 'conversations:delete',
  conversationsSearch: 'conversations:search',
  conversationsSetPinned: 'conversations:set-pinned',
  conversationsExport: 'conversations:export',
  memoryGet: 'memory:get',
  memorySet: 'memory:set',
  shortcutGet: 'shortcut:get',
  shortcutSet: 'shortcut:set',
  shortcutSuspend: 'shortcut:suspend',
  shortcutResume: 'shortcut:resume',
  loginItemGet: 'login-item:get',
  loginItemSet: 'login-item:set',
  agentsList: 'agents:list',
  agentsSave: 'agents:save',
  agentsRemove: 'agents:remove',
  agentsSetFavorite: 'agents:set-favorite',
  agentsMarkUsed: 'agents:mark-used',
  agentsExport: 'agents:export',
  agentsImport: 'agents:import',
  keyStatus: 'key:status',
  keySave: 'key:save',
  keyDelete: 'key:delete',
  chatSend: 'chat:send',
  chatStop: 'chat:stop',
  chatReset: 'chat:reset',
  chatEvent: 'chat:event',
  chatConfirm: 'chat:confirm',
  connectorsList: 'connectors:list',
  connectorsSave: 'connectors:save',
  connectorsRemove: 'connectors:remove',
  providerGet: 'provider:get',
  providerSet: 'provider:set',
  subscriptionStatus: 'subscription:status',
  subscriptionLogin: 'subscription:login',
  generateAgent: 'generate:agent',
  copyText: 'clipboard:copy'
} as const

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; message: string }

export type TransferResult = Result<{ canceled: boolean; message: string }>

/** `subscription` passe par Claude Code et ton forfait ; `api` par une clé facturée à l'usage. */
export const PROVIDERS = ['subscription', 'api'] as const
export type Provider = (typeof PROVIDERS)[number]

export interface SubscriptionStatus {
  installed: boolean
  loggedIn: boolean
  /** `false` si Claude Code est connecté avec un compte Console, facturé à l'usage. */
  billedToPlan: boolean
  plan: string | null
}

export interface SaveKeyResult {
  /** `false` : clé enregistrée, mais impossible de la vérifier faute de réseau. */
  verified: boolean
}

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

/** Où le panneau doit aller : les réglages, ou une conversation précise. */
export type PanelNavigation = 'settings' | { agentId: string; conversationId: string }

export interface PanelApi {
  onState(listener: (state: PanelState) => void): () => void
  painted(requestedAt: number): void
  close(): void
  onNavigate(listener: (target: PanelNavigation) => void): () => void
}

export interface PaletteApi {
  /** `true` à chaque ouverture, `false` à la fermeture. */
  onState(listener: (open: boolean) => void): () => void
  /** Hauteur voulue par le contenu ; le main la borne à l'écran. */
  resize(height: number): void
  close(): void
  /** Ferme la palette et ouvre la conversation dans le panneau. */
  continueInPanel(agentId: string, conversationId: string): void
}

export interface ConversationsApi {
  list(agentId: string): Promise<ConversationSummary[]>
  get(agentId: string, id: string): Promise<Conversation | null>
  remove(agentId: string, id: string): Promise<void>
  /** Cherche dans toutes les conversations de tous les agents. */
  search(query: string): Promise<SearchHit[]>
  setPinned(agentId: string, id: string, pinned: boolean): Promise<void>
  /** Enregistre la conversation en Markdown, à l'endroit choisi. */
  exportMarkdown(agentId: string, id: string): Promise<TransferResult>
}

export interface MemoryApi {
  get(agentId: string): Promise<string[]>
  set(agentId: string, facts: string[]): Promise<string[]>
}

export interface ShortcutState {
  accelerator: string
  /** `false` : le raccourci est pris par une autre app et ne répond pas. */
  active: boolean
}

export interface PreferencesApi {
  getShortcut(): Promise<ShortcutState>
  setShortcut(accelerator: string): Promise<Result>
  suspendShortcut(): void
  resumeShortcut(): void
  getLoginItem(): Promise<boolean>
  setLoginItem(enabled: boolean): Promise<Result>
}

export interface AgentsApi {
  list(): Promise<Agent[]>
  /** `id` nul : crée un nouvel agent. */
  save(id: string | null, draft: AgentDraft): Promise<Agent>
  remove(id: string): Promise<void>
  setFavorite(id: string, isFavorite: boolean): Promise<Agent>
  markUsed(id: string): Promise<void>
  /** Dernier agent utilisé, ou `null`. */
  lastUsed(): Promise<string | null>
  /** `id` nul : exporte tous les agents. */
  exportToFile(id: string | null): Promise<TransferResult>
  importFromFile(): Promise<TransferResult>
}

/** La clé va du renderer vers le main, jamais en sens inverse. */
export interface KeyApi {
  isSet(): Promise<boolean>
  save(key: string): Promise<Result<SaveKeyResult>>
  remove(): Promise<void>
}

export interface ChatApi {
  /** `agentId` nul : essai depuis l'assistant, dont rien n'est conservé. */
  send(sessionId: string, agent: AgentDraft, text: string, agentId: string | null, attachments?: AttachmentInput[]): void
  stop(sessionId: string): void
  reset(sessionId: string): void
  onEvent(listener: (event: ChatEvent) => void): () => void
  /** Réponse à une carte de confirmation. */
  confirm(id: string, approved: boolean): void
}

/** Les jetons vont du renderer vers le main, jamais en sens inverse. */
export interface ConnectorsApi {
  list(): Promise<Connector[]>
  /** `id` nul : ajoute un connecteur. */
  save(id: string | null, input: ConnectorInput): Promise<Result<Connector>>
  remove(id: string): Promise<void>
}

export interface ConnectionApi {
  getProvider(): Promise<Provider>
  setProvider(provider: Provider): Promise<void>
  subscriptionStatus(): Promise<SubscriptionStatus>
  login(): Promise<Result<SubscriptionStatus>>
}

export interface ToolboxApi {
  widget: WidgetApi
  panel: PanelApi
  palette: PaletteApi
  agents: AgentsApi
  key: KeyApi
  connection: ConnectionApi
  conversations: ConversationsApi
  memory: MemoryApi
  preferences: PreferencesApi
  chat: ChatApi
  connectors: ConnectorsApi
  generateAgent(description: string): Promise<Result<AgentDraft>>
  copyText(text: string): void
}
