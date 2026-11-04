import Anthropic from '@anthropic-ai/sdk'
import { clipboard, ipcMain, type WebContents } from 'electron'
import { z } from 'zod'
import { AgentDraftSchema } from '../shared/agent'
import type { ChatEvent } from '../shared/chat'
import { IPC, PROVIDERS, type Result, type SaveKeyResult } from '../shared/ipc'
import { sendMessage, resetSession, stopMessage } from './ai/chat'
import {
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
import { canStoreSecrets, deleteApiKey, readApiKey, writeApiKey } from './store/secrets'
import { getSettings, updateSettings } from './store/settings'

const usesSubscription = (): boolean => getSettings().provider === 'subscription'

const SessionIdSchema = z.string().min(1).max(100)
const TextSchema = z.string().trim().min(1).max(100_000)
const DescriptionSchema = z.string().trim().min(1).max(2000)
const KeySchema = z.string().trim().min(1).max(500)

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

export function registerAiIpc(): void {
  ipcMain.handle(IPC.keyStatus, () => readApiKey() !== null)
  ipcMain.handle(IPC.keySave, (_event, key: unknown) => saveKey(key))
  ipcMain.handle(IPC.keyDelete, () => {
    deleteApiKey()
    resetClient()
  })

  ipcMain.on(IPC.chatSend, (event, sessionId: unknown, agent: unknown, text: unknown) => {
    const session = SessionIdSchema.parse(sessionId)
    const sender: WebContents = event.sender
    const emit = (chatEvent: ChatEvent): void => {
      if (!sender.isDestroyed()) sender.send(IPC.chatEvent, chatEvent)
    }
    const draft = AgentDraftSchema.parse(agent)
    const message = TextSchema.parse(text)
    if (usesSubscription()) sendViaClaudeCode(session, draft, message, emit)
    else void sendMessage(session, draft, message, emit)
  })
  ipcMain.on(IPC.chatStop, (_event, sessionId: unknown) => {
    const session = SessionIdSchema.parse(sessionId)
    stopViaClaudeCode(session)
    stopMessage(session)
  })
  ipcMain.on(IPC.chatReset, (_event, sessionId: unknown) => {
    const session = SessionIdSchema.parse(sessionId)
    resetClaudeCodeSession(session)
    resetSession(session)
  })

  ipcMain.handle(IPC.generateAgent, (_event, description: unknown) => {
    const parsed = DescriptionSchema.parse(description)
    return usesSubscription() ? generateViaClaudeCode(parsed) : generateAgent(parsed)
  })

  ipcMain.handle(IPC.providerGet, () => getSettings().provider)
  ipcMain.handle(IPC.providerSet, (_event, provider: unknown) => {
    updateSettings({ provider: z.enum(PROVIDERS).parse(provider) })
  })
  ipcMain.handle(IPC.subscriptionStatus, () => subscriptionStatus())
  ipcMain.handle(IPC.subscriptionLogin, () => loginToSubscription())

  ipcMain.on(IPC.copyText, (_event, text: unknown) => clipboard.writeText(z.string().parse(text)))
}
