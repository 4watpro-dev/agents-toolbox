import Anthropic from '@anthropic-ai/sdk'
import { clipboard, ipcMain, type WebContents } from 'electron'
import { z } from 'zod'
import { AgentDraftSchema } from '../shared/agent'
import type { ChatEvent } from '../shared/chat'
import { ConnectorInputSchema, type Connector } from '../shared/connectors'
import { IPC, PROVIDERS, type Result, type SaveKeyResult } from '../shared/ipc'
import { prepareAttachments } from './ai/attachments'
import { forgetApiSessions, stopMessage } from './ai/chat'
import {
  forgetClaudeSessions,
  generateViaClaudeCode,
  loginToSubscription,
  stopViaClaudeCode,
  subscriptionStatus
} from './ai/claudeCode'
import { createClient, resetClient } from './ai/client'
import { classifyError } from './ai/errors'
import { generateAgent } from './ai/generate'
import { answerConfirmation } from './ai/toolBridge'
import { clearToken, getConnector, listConnectors, removeConnector, saveConnector } from './store/connectors'
import { loginConnector, logoutConnector, offersOAuth } from './oauth/connectorLogin'
import { OAuthError } from './oauth/mcpOAuth'
import { openPanel } from './windows'
import {
  allConversations,
  deleteConversation,
  getConversation,
  getFacts,
  listConversations,
  setFacts,
  setPinned
} from './store/conversations'
import { cancelSession, runTurn, usesSubscription } from './turns'
import { listAgents } from './store/agents'
import { searchConversations } from '../shared/history'
import { canStoreSecrets, deleteApiKey, readApiKey, writeApiKey } from './store/secrets'
import { getSettings, updateSettings } from './store/settings'


const SessionIdSchema = z.string().regex(/^[\w-]{1,100}$/)
// Ces identifiants composent des chemins de fichiers : uniquement des UUID.
const ConversationIdSchema = z.uuid()
const AgentIdSchema = z.uuid()
const TextSchema = z.string().trim().min(1).max(100_000)
/** Avec des pièces jointes, le message peut se passer de texte. */
const OptionalTextSchema = z.string().trim().max(100_000)
const DescriptionSchema = z.string().trim().min(1).max(2000)
const KeySchema = z.string().trim().min(1).max(500)
const FactsSchema = z.array(z.string().max(2000)).max(200)


/** Vérifie la clé avec un appel gratuit. Sans réseau, elle est gardée mais signalée comme non vérifiée. */
async function saveKey(raw: unknown): Promise<Result<SaveKeyResult>> {
  const parsed = KeySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, message: 'Colle ta clé API dans le champ.' }
  if (!canStoreSecrets()) {
    return { ok: false, message: 'Le trousseau macOS est indisponible : la clé ne peut pas être chiffrée, elle n\'a pas été enregistrée.' }
  }
  let verified = true
  try {
    await createClient(parsed.data).models.list({ limit: 1 })
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionError) {
      verified = false
    } else {
      return { ok: false, message: classifyError(error).message }
    }
  }
  writeApiKey(parsed.data)
  resetClient()
  return { ok: true, value: { verified } }
}

function startTurn(
  sender: WebContents,
  sessionId: string,
  agentIdRaw: unknown,
  agentRaw: unknown,
  textRaw: unknown,
  attachmentsRaw: unknown
): void {
  const deliver = (event: ChatEvent): void => {
    if (!sender.isDestroyed()) sender.send(IPC.chatEvent, event)
  }
  const draft = AgentDraftSchema.parse(agentRaw)
  const prepared = prepareAttachments(attachmentsRaw)
  if (!prepared.ok) {
    deliver({ sessionId, type: 'error', failure: { code: 'bad_request', message: prepared.message } })
    return
  }
  const attachments = prepared.value
  const text = attachments.length > 0 ? OptionalTextSchema.parse(textRaw) : TextSchema.parse(textRaw)
  // `null` : essai depuis l'assistant, dont rien n'est conservé.
  const agentId = agentIdRaw === null ? null : AgentIdSchema.parse(agentIdRaw)
  if (agentId) ConversationIdSchema.parse(sessionId)
  runTurn({ sessionId, agentId, draft, text, attachments }, deliver)
}

export function registerAiIpc(): void {
  ipcMain.handle(IPC.keyStatus, () => readApiKey() !== null)
  ipcMain.handle(IPC.keySave, (_event, key: unknown) => saveKey(key))
  ipcMain.handle(IPC.keyDelete, () => {
    deleteApiKey()
    resetClient()
  })

  ipcMain.on(IPC.chatSend, (event, sessionId: unknown, agent: unknown, text: unknown, agentId: unknown, attachments: unknown) => {
    startTurn(event.sender, SessionIdSchema.parse(sessionId), agentId, agent, text, attachments)
  })
  ipcMain.on(IPC.chatStop, (_event, sessionId: unknown) => {
    const session = SessionIdSchema.parse(sessionId)
    stopViaClaudeCode(session)
    stopMessage(session)
  })
  ipcMain.on(IPC.chatReset, (_event, sessionId: unknown) => cancelSession(SessionIdSchema.parse(sessionId)))
  ipcMain.on(IPC.chatConfirm, (_event, id: unknown, approved: unknown) => {
    answerConfirmation(z.uuid().parse(id), z.boolean().parse(approved))
  })

  ipcMain.handle(IPC.connectorsList, () => listConnectors())
  ipcMain.handle(IPC.connectorsSave, async (_event, id: unknown, input: unknown): Promise<Result<Connector>> => {
    const parsed = ConnectorInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: "Vérifie le nom et l'adresse : https obligatoire, sans identifiant ni jeton dans l'adresse." }
    }
    const connectorId = id === null ? null : z.uuid().parse(id)
    const existing = connectorId ? listConnectors().find((connector) => connector.id === connectorId) : undefined
    const sameServer = existing !== undefined && existing.url === parsed.data.url && parsed.data.token === null
    // Un jeton saisi garde le mode jeton. Sinon, un 401 avec découverte OAuth propose « Se connecter ».
    const auth = parsed.data.token
      ? 'token'
      : sameServer && (existing.auth === 'oauth' || existing.hasToken)
        ? existing.auth
        : (await offersOAuth(parsed.data.url))
          ? 'oauth'
          : 'token'
    return saveConnector(connectorId, parsed.data, auth)
  })
  ipcMain.handle(IPC.connectorsRemove, (_event, id: unknown) => removeConnector(z.uuid().parse(id)))
  ipcMain.handle(IPC.connectorsLogin, async (_event, id: unknown): Promise<Result<Connector>> => {
    const connector = getConnector(z.uuid().parse(id))
    if (!connector || connector.auth !== 'oauth') return { ok: false, message: 'Ce connecteur ne se connecte pas par OAuth.' }
    if (!canStoreSecrets()) return { ok: false, message: "Le trousseau macOS est indisponible : les jetons ne pourraient pas être chiffrés." }
    try {
      await loginConnector(connector)
    } catch (error) {
      return { ok: false, message: error instanceof OAuthError ? error.message : "La connexion n'a pas abouti. Réessaie." }
    } finally {
      // Retour au panneau, que la connexion ait réussi ou non : le navigateur a pris le premier plan.
      openPanel()
    }
    const value = listConnectors().find((other) => other.id === connector.id)
    return value ? { ok: true, value } : { ok: false, message: 'Ce connecteur a été supprimé.' }
  })
  // Se déconnecter vaut pour tous les connecteurs : OAuth révoque puis efface ses jetons,
  // un connecteur à jeton perd le jeton collé. Dans les deux cas, le connecteur reste.
  ipcMain.handle(IPC.connectorsLogout, async (_event, id: unknown) => {
    const connector = getConnector(z.uuid().parse(id))
    if (!connector) return
    if (connector.auth === 'oauth') await logoutConnector(connector.id)
    else clearToken(connector.id)
  })

  ipcMain.handle(IPC.conversationsList, (_event, agentId: unknown) => listConversations(AgentIdSchema.parse(agentId)))
  ipcMain.handle(IPC.conversationsGet, (_event, agentId: unknown, id: unknown) =>
    getConversation(AgentIdSchema.parse(agentId), ConversationIdSchema.parse(id))
  )
  ipcMain.handle(IPC.conversationsDelete, (_event, agentId: unknown, id: unknown) => {
    const conversationId = ConversationIdSchema.parse(id)
    cancelSession(conversationId)
    deleteConversation(AgentIdSchema.parse(agentId), conversationId)
  })

  ipcMain.handle(IPC.conversationsSearch, (_event, query: unknown) =>
    searchConversations(allConversations(listAgents().map((agent) => agent.id)), z.string().max(200).parse(query))
  )
  ipcMain.handle(IPC.conversationsSetPinned, (_event, agentId: unknown, id: unknown, pinned: unknown) =>
    setPinned(AgentIdSchema.parse(agentId), ConversationIdSchema.parse(id), z.boolean().parse(pinned))
  )

  ipcMain.handle(IPC.memoryGet, (_event, agentId: unknown) => getFacts(AgentIdSchema.parse(agentId)))
  ipcMain.handle(IPC.memorySet, (_event, agentId: unknown, facts: unknown) =>
    setFacts(AgentIdSchema.parse(agentId), FactsSchema.parse(facts))
  )

  ipcMain.handle(IPC.generateAgent, (_event, description: unknown) => {
    const parsed = DescriptionSchema.parse(description)
    return usesSubscription() ? generateViaClaudeCode(parsed) : generateAgent(parsed)
  })

  ipcMain.handle(IPC.providerGet, () => getSettings().provider)
  ipcMain.handle(IPC.providerSet, (_event, provider: unknown) => {
    updateSettings({ provider: z.enum(PROVIDERS).parse(provider) })
    // L'autre mode n'a pas vu les derniers échanges : tout repart des conversations enregistrées.
    forgetClaudeSessions()
    forgetApiSessions()
  })
  ipcMain.handle(IPC.subscriptionStatus, () => subscriptionStatus())
  ipcMain.handle(IPC.subscriptionLogin, () => loginToSubscription())

  ipcMain.on(IPC.copyText, (_event, text: unknown) => clipboard.writeText(z.string().parse(text)))
}
