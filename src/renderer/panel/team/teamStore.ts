import { useSyncExternalStore } from 'react'
import { applyTeamEvent, newRun, runFromRecord, type TeamRun } from './teamState'

// Le magasin vit hors des composants : quitter l'écran d'une équipe pendant
// qu'elle travaille ne fait rien perdre, et le suivi reprend au retour.
const conversations = new Map<string, TeamRun[]>()
/** Équipe → conversation en cours de travail. */
const working = new Map<string, string>()
const owners = new Map<string, string>()
const listeners = new Set<() => void>()
const EMPTY: TeamRun[] = []
let subscribed = false

function notify(): void {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  if (!subscribed) {
    subscribed = true
    window.toolbox.team.onEvent((event) => {
      const runs = conversations.get(event.conversationId)
      const last = runs?.at(-1)
      if (!runs || last?.status !== 'running') return
      conversations.set(event.conversationId, [...runs.slice(0, -1), applyTeamEvent(last, event)])
      if (event.type === 'done' || event.type === 'error' || event.type === 'stopped') {
        const teamId = owners.get(event.conversationId)
        if (teamId && working.get(teamId) === event.conversationId) working.delete(teamId)
      }
      notify()
    })
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTeamRuns(conversationId: string): TeamRun[] {
  return useSyncExternalStore(subscribe, () => conversations.get(conversationId) ?? EMPTY)
}

/** Charge une conversation enregistrée, sauf si elle est déjà suivie ici (en cours, par exemple). */
export async function loadTeamConversation(teamId: string, conversationId: string): Promise<void> {
  if (conversations.has(conversationId)) return
  const conversation = await window.toolbox.team.conversation(teamId, conversationId)
  if (conversations.has(conversationId)) return
  conversations.set(conversationId, conversation ? conversation.runs.map((record, index) => runFromRecord(record, index + 1)) : [])
  owners.set(conversationId, teamId)
  notify()
}

export function startTeamRun(teamId: string, conversationId: string, text: string): void {
  const runs = conversations.get(conversationId) ?? []
  conversations.set(conversationId, [...runs, newRun(runs.length + 1, text)])
  owners.set(conversationId, teamId)
  working.set(teamId, conversationId)
  notify()
  window.toolbox.team.run(teamId, conversationId, text)
}

/** Conversation où l'équipe travaille en ce moment, pour y revenir directement. */
export function workingConversation(teamId: string): string | undefined {
  return working.get(teamId)
}

/** Conversation supprimée : elle disparaît aussi de l'affichage. */
export function forgetTeamConversation(conversationId: string): void {
  conversations.delete(conversationId)
  notify()
}
