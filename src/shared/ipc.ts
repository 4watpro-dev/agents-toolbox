// Importé par le preload, qui tourne en sandbox et ne peut charger aucun module
// npm : ce fichier ne doit avoir aucune dépendance à l'exécution. Les imports de
// types sont effacés à la compilation. Les schémas zod sont utilisés côté main.
import type { Agent, AgentDraft } from './agent'
import type { AvatarConfig } from './avatar'
import type { ChatEvent } from './chat'
import type { Conversation, ConversationSummary } from './conversation'

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
  conversationsList: 'conversations:list',
  conversationsGet: 'conversations:get',
  conversationsDelete: 'conversations:delete',
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
  keyStatus: 'key:status',
  keySave: 'key:save',
  keyDelete: 'key:delete',
  chatSend: 'chat:send',
  chatStop: 'chat:stop',
  chatReset: 'chat:reset',
  chatEvent: 'chat:event',
  providerGet: 'provider:get',
  providerSet: 'provider:set',
  subscriptionStatus: 'subscription:status',
  subscriptionLogin: 'subscription:login',
  generateAgent: 'generate:agent',
  copyText: 'clipboard:copy'
} as const

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; message: string }

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

export interface PanelApi {
  onState(listener: (state: PanelState) => void): () => void
  painted(requestedAt: number): void
  close(): void
  onNavigate(listener: (target: 'settings') => void): () => void
}

export interface ConversationsApi {
  list(agentId: string): Promise<ConversationSummary[]>
  get(agentId: string, id: string): Promise<Conversation | null>
  remove(agentId: string, id: string): Promise<void>
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
}

/** La clé va du renderer vers le main, jamais en sens inverse. */
export interface KeyApi {
  isSet(): Promise<boolean>
  save(key: string): Promise<Result<SaveKeyResult>>
  remove(): Promise<void>
}

export interface ChatApi {
  /** `agentId` nul : essai depuis l'assistant, dont rien n'est conservé. */
  send(sessionId: string, agent: AgentDraft, text: string, agentId: string | null): void
  stop(sessionId: string): void
  reset(sessionId: string): void
  onEvent(listener: (event: ChatEvent) => void): () => void
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
  agents: AgentsApi
  key: KeyApi
  connection: ConnectionApi
  conversations: ConversationsApi
  memory: MemoryApi
  preferences: PreferencesApi
  chat: ChatApi
  generateAgent(description: string): Promise<Result<AgentDraft>>
  copyText(text: string): void
}
