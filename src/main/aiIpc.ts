import Anthropic from '@anthropic-ai/sdk'
import { clipboard, ipcMain, type WebContents } from 'electron'
import { z } from 'zod'
import { AgentDraftSchema } from '../shared/agent'
import type { ChatEvent } from '../shared/chat'
import { IPC, PROVIDERS, type Result, type SaveKeyResult } from '../shared/ipc'
import { buildSystemPrompt } from '../shared/systemPrompt'
import { forgetApiSessions, sendMessage, resetSession, stopMessage } from './ai/chat'
import {
  claudeResumeId,
  forgetClaudeSessions,
  generateViaClaudeCode,
  loginToSubscription,
  resetClaudeCodeSession,
  sendViaClaudeCode,
  stopViaClaudeCode,
  subscriptionStatus
} from './ai/claudeCode'
import { createClient, resetClient } from './ai/client'
import { classifyError } from './ai/errors'
import { generateAgent } from './ai/generate'
import {
  appendTurns,
  deleteConversation,
  getConversation,
  getFacts,
  listConversations,
  rememberFacts,
  setClaudeSession,
  setFacts
} from './store/conversations'
import { canStoreSecrets, deleteApiKey, readApiKey, writeApiKey } from './store/secrets'
import { getSettings, updateSettings } from './store/settings'

const usesSubscription = (): boolean => getSettings().provider === 'subscription'

const SessionIdSchema = z.string().regex(/^[\w-]{1,100}$/)
// Ces identifiants composent des chemins de fichiers : uniquement des UUID.
const ConversationIdSchema = z.uuid()
const AgentIdSchema = z.uuid()
const TextSchema = z.string().trim().min(1).max(100_000)
const DescriptionSchema = z.string().trim().min(1).max(2000)
const KeySchema = z.string().trim().min(1).max(500)
const FactsSchema = z.array(z.string().max(2000)).max(200)

/** Tours en cours. Retirer une entrée rend muette la fin d'un tour annulé par une suppression. */
const activeTurns = new Map<string, { agentId: string | null; visibleText: string; afterTool: boolean }>()

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

function startTurn(sender: WebContents, sessionId: string, agentIdRaw: unknown, agentRaw: unknown, textRaw: unknown): void {
  if (activeTurns.has(sessionId)) return
  const draft = AgentDraftSchema.parse(agentRaw)
  const text = TextSchema.parse(textRaw)
  // `null` : essai depuis l'assistant, dont rien n'est conservé.
  const agentId = agentIdRaw === null ? null : AgentIdSchema.parse(agentIdRaw)
  if (agentId) ConversationIdSchema.parse(sessionId)

  const conversation = agentId ? getConversation(agentId, sessionId) : null
  const facts = agentId ? getFacts(agentId) : []
  const context = {
    systemPrompt: buildSystemPrompt(draft, facts, { remember: agentId !== null }),
    turns: conversation?.messages ?? [],
    resumeId: conversation?.claudeSessionId ?? null
  }

  const turn = { agentId, visibleText: '', afterTool: false }
  activeTurns.set(sessionId, turn)
  const resumeIdToKeep = (): string | null => (usesSubscription() ? claudeResumeId(sessionId) : null)

  const emit = (event: ChatEvent): void => {
    if (activeTurns.get(sessionId) !== turn) return
    let outgoing = event
    if (event.type === 'tool') {
      turn.afterTool = true
    } else if (event.type === 'delta') {
      // Le texte qui suit un outil ne doit pas se coller à la phrase qui l'annonçait.
      const text = turn.afterTool && turn.visibleText ? `\n\n${event.text}` : event.text
      turn.afterTool = false
      turn.visibleText += text
      outgoing = { ...event, text }
    } else {
      activeTurns.delete(sessionId)
      if (agentId) {
        if (event.type === 'done') {
          appendTurns(
            agentId,
            sessionId,
            [
              { role: 'user', text },
              { role: 'assistant', text: turn.visibleText.trim() }
            ],
            resumeIdToKeep()
          )
          outgoing = { ...event, facts: rememberFacts(agentId, event.facts) }
        } else if (event.type === 'stopped') {
          const partial = turn.visibleText.trim()
          appendTurns(
            agentId,
            sessionId,
            [{ role: 'user', text }, ...(partial ? [{ role: 'assistant' as const, text: partial }] : [])],
            null
          )
        } else {
          setClaudeSession(agentId, sessionId, null)
        }
      } else if (event.type === 'done') {
        outgoing = { ...event, facts: [] }
      }
    }
    if (!sender.isDestroyed()) sender.send(IPC.chatEvent, outgoing)
  }

  if (usesSubscription()) sendViaClaudeCode(sessionId, draft, text, emit, context)
  else void sendMessage(sessionId, draft, text, emit, context)
}

function cancelSession(sessionId: string): void {
  activeTurns.delete(sessionId)
  resetClaudeCodeSession(sessionId)
  resetSession(sessionId)
}

export function registerAiIpc(): void {
  ipcMain.handle(IPC.keyStatus, () => readApiKey() !== null)
  ipcMain.handle(IPC.keySave, (_event, key: unknown) => saveKey(key))
  ipcMain.handle(IPC.keyDelete, () => {
    deleteApiKey()
    resetClient()
  })

  ipcMain.on(IPC.chatSend, (event, sessionId: unknown, agent: unknown, text: unknown, agentId: unknown) => {
    startTurn(event.sender, SessionIdSchema.parse(sessionId), agentId, agent, text)
  })
  ipcMain.on(IPC.chatStop, (_event, sessionId: unknown) => {
    const session = SessionIdSchema.parse(sessionId)
    stopViaClaudeCode(session)
    stopMessage(session)
  })
  ipcMain.on(IPC.chatReset, (_event, sessionId: unknown) => cancelSession(SessionIdSchema.parse(sessionId)))

  ipcMain.handle(IPC.conversationsList, (_event, agentId: unknown) => listConversations(AgentIdSchema.parse(agentId)))
  ipcMain.handle(IPC.conversationsGet, (_event, agentId: unknown, id: unknown) =>
    getConversation(AgentIdSchema.parse(agentId), ConversationIdSchema.parse(id))
  )
  ipcMain.handle(IPC.conversationsDelete, (_event, agentId: unknown, id: unknown) => {
    const conversationId = ConversationIdSchema.parse(id)
    cancelSession(conversationId)
    deleteConversation(AgentIdSchema.parse(agentId), conversationId)
  })

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
