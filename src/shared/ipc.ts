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
import type { Task, TaskInput } from './schedule'
import type { ToolActivity } from './tools'
import type { Assignment } from './team'
import type { Team, TeamConversation, TeamConversationSummary, TeamInput } from './teams'

export const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
export type Corner = (typeof CORNERS)[number]

export const IPC = {
  widgetClick: 'widget:click',
  widgetDragStart: 'widget:drag-start',
  widgetDragEnd: 'widget:drag-end',
  widgetGetAvatar: 'widget:get-avatar',
  widgetAvatar: 'widget:avatar',
  widgetBadge: 'widget:badge',
  widgetSignal: 'widget:signal',
  tasksList: 'tasks:list',
  tasksSave: 'tasks:save',
  tasksRemove: 'tasks:remove',
  tasksRunNow: 'tasks:run-now',
  tasksChanged: 'tasks:changed',
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
  connectorsLogin: 'connectors:login',
  connectorsLogout: 'connectors:logout',
  providerGet: 'provider:get',
  providerSet: 'provider:set',
  subscriptionStatus: 'subscription:status',
  subscriptionLogin: 'subscription:login',
  generateAgent: 'generate:agent',
  knowledgeChoose: 'knowledge:choose',
  filesExportReply: 'files:export-reply',
  filesSaveText: 'files:save-text',
  teamRun: 'team:run',
  teamsList: 'teams:list',
  teamsSave: 'teams:save',
  teamsRemove: 'teams:remove',
  teamConversationsList: 'team-conversations:list',
  teamConversationsGet: 'team-conversations:get',
  teamConversationsDelete: 'team-conversations:delete',
  teamContinueWithChief: 'team:continue-with-chief',
  teamStop: 'team:stop',
  teamEvent: 'team:event',
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
  /** Pastille : un résultat de tâche attend d'être lu. */
  onBadge(listener: (visible: boolean) => void): () => void
  /** Ce qui se passe autour : absence, retour, tâche en cours. */
  onSignal(listener: (signal: WidgetSignal) => void): () => void
}

/** Ce à quoi le fantôme de l'icône réagit. */
export type WidgetSignal = { type: 'away' } | { type: 'back' } | { type: 'working'; on: boolean }

/** Tâche telle que l'interface l'affiche : avec sa prochaine exécution et son état. */
export interface TaskView extends Task {
  nextRunAt: string | null
  running: boolean
}

/** Déroulé d'un travail d'équipe, envoyé au fil de l'eau. */
export type TeamEvent = { conversationId: string } & (
  | { type: 'phase'; phase: 'plan' | 'synthesis' }
  | { type: 'plan'; assignments: Assignment[] }
  | { type: 'member-start'; agentId: string }
  | { type: 'member-delta'; agentId: string; text: string }
  | { type: 'member-done'; agentId: string; problem?: string }
  /** Ce que fait un agent de l'équipe en ce moment (recherche web, lecture de documents). */
  | { type: 'activity'; agentId: string; activity: ToolActivity }
  | { type: 'delta'; text: string }
  | { type: 'done'; answer: string }
  | { type: 'stopped' }
  | { type: 'error'; message: string }
)

export interface TeamApi {
  list(): Promise<Team[]>
  /** `id` nul : crée une équipe. */
  save(id: string | null, input: TeamInput): Promise<Result<Team>>
  /** Supprime l'équipe, son historique et ses tâches. */
  remove(id: string): Promise<void>
  conversations(teamId: string): Promise<TeamConversationSummary[]>
  conversation(teamId: string, id: string): Promise<TeamConversation | null>
  removeConversation(teamId: string, id: string): Promise<void>
  /** Lance une demande dans une conversation d'équipe (nouvelle ou existante). */
  run(teamId: string, conversationId: string, text: string): void
  stop(conversationId: string): void
  onEvent(listener: (event: TeamEvent) => void): () => void
  /** Recopie la conversation chez le chef et renvoie où l'ouvrir. */
  continueWithChief(teamId: string, conversationId: string): Promise<Result<{ agentId: string; conversationId: string }>>
}

export type ExportFormat = 'md' | 'pdf' | 'docx'

export interface FilesApi {
  /** Met une réponse en forme et l'enregistre à l'endroit choisi. */
  exportReply(payload: { format: ExportFormat; title: string; markdown: string; html: string }): Promise<TransferResult>
  /** Enregistre un bloc de code (script, CSV…) à l'endroit choisi. */
  saveText(payload: { name: string; content: string }): Promise<TransferResult>
}

export interface TasksApi {
  /** Tâches d'un agent ou d'une équipe. */
  list(owner: { agentId: string } | { teamId: string }): Promise<TaskView[]>
  /** `id` nul : crée une tâche. */
  save(id: string | null, input: TaskInput): Promise<Result<TaskView>>
  remove(id: string): Promise<void>
  runNow(id: string): void
  /** Une tâche a commencé ou fini. */
  onChanged(listener: () => void): () => void
}

/** Où le panneau doit aller : les réglages, ou une conversation précise. */
export type PanelNavigation =
  | 'settings'
  | { agentId: string; conversationId: string }
  | { teamId: string; conversationId: string }

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
  /** Connexion OAuth dans le navigateur du Mac ; se termine quand le navigateur a répondu. */
  login(id: string): Promise<Result<Connector>>
  logout(id: string): Promise<void>
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
  tasks: TasksApi
  files: FilesApi
  team: TeamApi
  generateAgent(description: string): Promise<Result<AgentDraft>>
  /** Choisit un dossier de documents. `null` : choix annulé. */
  chooseKnowledgeFolder(): Promise<Result<{ path: string; name: string } | null>>
  copyText(text: string): void
}
