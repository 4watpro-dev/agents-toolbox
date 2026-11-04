import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import {
  cleanFacts,
  ConversationSchema,
  conversationTitle,
  MemorySchema,
  mergeFacts,
  type Conversation,
  type ConversationSummary,
  type Turn
} from '../../shared/conversation'
import { readJson, writeJson } from './jsonFile'

const conversationsRoot = (): string => join(app.getPath('userData'), 'conversations')
const memoryRoot = (): string => join(app.getPath('userData'), 'memory')
const agentDirectory = (agentId: string): string => join(conversationsRoot(), agentId)
const conversationPath = (agentId: string, id: string): string => join(agentDirectory(agentId), `${id}.json`)
const memoryPath = (agentId: string): string => join(memoryRoot(), `${agentId}.json`)

export function getConversation(agentId: string, id: string): Conversation | null {
  return readJson(conversationPath(agentId, id), ConversationSchema, null)
}

export function listConversations(agentId: string): ConversationSummary[] {
  let files: string[]
  try {
    files = readdirSync(agentDirectory(agentId))
  } catch {
    return []
  }
  return files
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const conversation = getConversation(agentId, file.slice(0, -'.json'.length))
      return conversation
        ? [
            {
              id: conversation.id,
              title: conversation.title,
              messageCount: conversation.messages.length,
              updatedAt: conversation.updatedAt
            }
          ]
        : []
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Ajoute des messages à une conversation, en la créant au premier échange. */
export function appendTurns(agentId: string, id: string, turns: Turn[], claudeSessionId: string | null): void {
  const now = new Date().toISOString()
  const existing = getConversation(agentId, id)
  const conversation: Conversation = existing
    ? { ...existing, messages: [...existing.messages, ...turns], claudeSessionId, updatedAt: now }
    : {
        id,
        agentId,
        title: conversationTitle(turns[0]?.text ?? ''),
        messages: turns,
        claudeSessionId,
        createdAt: now,
        updatedAt: now
      }
  writeJson(conversationPath(agentId, id), conversation)
}

export function setClaudeSession(agentId: string, id: string, claudeSessionId: string | null): void {
  const existing = getConversation(agentId, id)
  if (existing) writeJson(conversationPath(agentId, id), { ...existing, claudeSessionId })
}

export function deleteConversation(agentId: string, id: string): void {
  rmSync(conversationPath(agentId, id), { force: true })
}

export function getFacts(agentId: string): string[] {
  return readJson(memoryPath(agentId), MemorySchema, { agentId, facts: [] }).facts
}

export function setFacts(agentId: string, facts: string[]): string[] {
  const cleaned = cleanFacts(facts)
  mkdirSync(memoryRoot(), { recursive: true })
  writeJson(memoryPath(agentId), { agentId, facts: cleaned })
  return cleaned
}

/** Retient de nouveaux faits et renvoie ceux qui ne figuraient pas déjà dans la mémoire. */
export function rememberFacts(agentId: string, incoming: string[]): string[] {
  if (incoming.length === 0) return []
  const { facts, added } = mergeFacts(getFacts(agentId), incoming)
  if (added.length > 0) writeJson(memoryPath(agentId), { agentId, facts })
  return added
}

/** Efface tout ce qui concerne un agent supprimé. */
export function deleteAgentData(agentId: string): void {
  rmSync(agentDirectory(agentId), { recursive: true, force: true })
  rmSync(memoryPath(agentId), { force: true })
}
