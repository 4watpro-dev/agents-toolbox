import type { AgentDraft } from '../shared/agent'
import type { ChatEvent } from '../shared/chat'
import type { Turn } from '../shared/conversation'
import { buildSystemPrompt } from '../shared/systemPrompt'
import type { PreparedAttachment } from './ai/attachments'
import { resetSession, sendMessage } from './ai/chat'
import { claudeResumeId, resetClaudeCodeSession, sendViaClaudeCode } from './ai/claudeCode'
import { resolveKnowledgeFolder } from './knowledge'
import { listConnectors, resolveConnectors } from './store/connectors'
import { appendTurns, getConversation, getFacts, rememberFacts, setClaudeSession } from './store/conversations'
import { getSettings } from './store/settings'

export const usesSubscription = (): boolean => getSettings().provider === 'subscription'

export interface TurnRequest {
  sessionId: string
  /** `null` : essai depuis l'assistant, dont rien n'est conservé. */
  agentId: string | null
  draft: AgentDraft
  text: string
  attachments: PreparedAttachment[]
  /**
   * Personne devant l'écran (tâche programmée) : pas de connecteurs, car leurs
   * actions attendent une confirmation que personne ne donnerait.
   */
  unattended?: boolean
  /**
   * Étape d'un travail d'équipe : l'agent garde sa mémoire et ses documents, mais
   * l'échange n'est pas enregistré dans son historique (l'équipe enregistre le sien).
   */
  ephemeral?: boolean
}

/** Tours en cours. Retirer une entrée rend muette la fin d'un tour annulé par une suppression. */
const activeTurns = new Map<string, { agentId: string | null; visibleText: string; afterTool: boolean }>()

export function isTurnActive(sessionId: string): boolean {
  return activeTurns.has(sessionId)
}

/**
 * Lance un tour de conversation et enregistre l'échange à la fin. `deliver`
 * reçoit les événements à afficher (ou à attendre, pour une tâche programmée).
 * Renvoie `false` si un tour tourne déjà dans cette session.
 */
export function runTurn(request: TurnRequest, deliver: (event: ChatEvent) => void): boolean {
  const { sessionId, agentId, draft, text, attachments } = request
  if (activeTurns.has(sessionId)) return false
  const metas = attachments.map((attachment) => attachment.meta)
  const userTurn: Turn = metas.length > 0 ? { role: 'user', text, attachments: metas } : { role: 'user', text }

  const conversation = agentId && !request.ephemeral ? getConversation(agentId, sessionId) : null
  const facts = agentId ? getFacts(agentId) : []
  // L'API exécuterait les actions de ses connecteurs sans passer par une confirmation.
  const connectorsAllowed = usesSubscription() && !request.unattended
  const wantedCount = listConnectors().filter((connector) => draft.tools.connectors.includes(connector.id)).length
  // Dossier de documents : lu par les outils de Claude Code, donc en mode abonnement seulement.
  const folder = draft.tools.knowledgeFolder ? resolveKnowledgeFolder(draft.tools.knowledgeFolder) : null
  const knowledge = folder?.ok && usesSubscription() ? folder : null

  const turn = { agentId, visibleText: '', afterTool: false }
  activeTurns.set(sessionId, turn)
  const resumeIdToKeep = (): string | null => (usesSubscription() ? claudeResumeId(sessionId) : null)

  const emit = (event: ChatEvent): void => {
    if (activeTurns.get(sessionId) !== turn) return
    let outgoing = event
    if (event.type === 'tool') {
      turn.afterTool = true
    } else if (event.type === 'confirm' || event.type === 'confirmed' || event.type === 'notice') {
      // Le tour continue : ces événements informent seulement l'interface.
    } else if (event.type === 'delta') {
      // Le texte qui suit un outil ne doit pas se coller à la phrase qui l'annonçait.
      const piece = turn.afterTool && turn.visibleText ? `\n\n${event.text}` : event.text
      turn.afterTool = false
      turn.visibleText += piece
      outgoing = { ...event, text: piece }
    } else {
      activeTurns.delete(sessionId)
      if (agentId && !request.ephemeral) {
        if (event.type === 'done') {
          appendTurns(agentId, sessionId, [userTurn, { role: 'assistant', text: turn.visibleText.trim() }], resumeIdToKeep())
          outgoing = { ...event, facts: rememberFacts(agentId, event.facts) }
        } else if (event.type === 'stopped') {
          const partial = turn.visibleText.trim()
          appendTurns(agentId, sessionId, [userTurn, ...(partial ? [{ role: 'assistant' as const, text: partial }] : [])], null)
        } else {
          setClaudeSession(agentId, sessionId, null)
        }
      } else if (event.type === 'done') {
        // Rien n'est enregistré : les faits proposés ne sont pas retenus non plus.
        outgoing = { ...event, facts: [] }
      }
    }
    deliver(outgoing)
  }

  // Les jetons OAuth se rafraîchissent par le réseau : le tour démarre juste après.
  void (async () => {
    let resolved: Awaited<ReturnType<typeof resolveConnectors>> = { connectors: [], needsLogin: [] }
    try {
      if (connectorsAllowed) resolved = await resolveConnectors(draft.tools.connectors)
    } catch {
      emit({ sessionId, type: 'error', failure: { code: 'unknown', message: "Les connecteurs n'ont pas pu être préparés. Réessaie." } })
      return
    }
    const { connectors, needsLogin } = resolved
    if (activeTurns.get(sessionId) !== turn) return
    const context = {
      systemPrompt: buildSystemPrompt(draft, facts, {
        remember: agentId !== null && !request.ephemeral,
        connectors: connectors.map((c) => c.name),
        knowledge: knowledge?.name ?? null
      }),
      turns: conversation?.messages ?? [],
      resumeId: conversation?.claudeSessionId ?? null,
      connectors,
      knowledge: knowledge?.path ?? null,
      confirmWeb: !request.unattended
    }

    if (!connectorsAllowed && wantedCount > 0) {
      emit({
        sessionId,
        type: 'notice',
        text: request.unattended
          ? "Les connecteurs ne servent pas aux tâches programmées : leurs actions demandent ta confirmation."
          : "Les connecteurs sont désactivés en mode clé API, faute de pouvoir y demander ta confirmation. Repasse sur ton abonnement pour t'en servir."
      })
    }
    if (needsLogin.length > 0) {
      emit({
        sessionId,
        type: 'notice',
        text: `${needsLogin.join(', ')} : connexion requise. Clique « Se connecter » dans la fiche de l'agent (Modifier › Compétences) ou dans Réglages › Connecteurs MCP. L'agent répond sans ce connecteur.`
      })
    }
    if (folder && !folder.ok) emit({ sessionId, type: 'notice', text: `${folder.message} L'agent répond sans ses documents.` })
    else if (folder && !usesSubscription()) {
      emit({ sessionId, type: 'notice', text: "Le dossier de documents ne fonctionne qu'avec ton abonnement : l'agent répond sans ses documents en mode clé API." })
    }
    const message = { text, attachments }
    if (usesSubscription()) sendViaClaudeCode(sessionId, draft, message, emit, context)
    else void sendMessage(sessionId, draft, message, emit, context)
  })()
  return true
}

export function cancelSession(sessionId: string): void {
  activeTurns.delete(sessionId)
  resetClaudeCodeSession(sessionId)
  resetSession(sessionId)
}

/** Récupère le texte visible d'un tour terminé, pour une tâche sans fenêtre. */
export function collectReply(): { deliver(event: ChatEvent): void; result: Promise<{ ok: boolean; text: string; message: string }> } {
  let text = ''
  let settle: (value: { ok: boolean; text: string; message: string }) => void = () => undefined
  const result = new Promise<{ ok: boolean; text: string; message: string }>((resolve) => {
    settle = resolve
  })
  return {
    deliver(event) {
      if (event.type === 'delta') text += event.text
      else if (event.type === 'done') settle({ ok: true, text, message: '' })
      else if (event.type === 'stopped') settle({ ok: false, text, message: 'Tâche interrompue.' })
      else if (event.type === 'error') settle({ ok: false, text, message: event.failure.message })
    },
    result
  }
}
