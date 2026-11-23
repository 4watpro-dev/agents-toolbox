import { randomUUID } from 'node:crypto'
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { conversationTitle } from '../../shared/conversation'
import {
  TeamConversationSchema,
  TeamSchema,
  withoutAgent,
  type Team,
  type TeamConversation,
  type TeamConversationSummary,
  type TeamInput,
  type TeamRunRecord
} from '../../shared/teams'
import { readJson, writeJson } from './jsonFile'

const teamsPath = (): string => join(app.getPath('userData'), 'teams.json')
const conversationsRoot = (): string => join(app.getPath('userData'), 'team-conversations')
const teamDirectory = (teamId: string): string => join(conversationsRoot(), teamId)
const conversationPath = (teamId: string, id: string): string => join(teamDirectory(teamId), `${id}.json`)

let teams: Team[] | null = null

function persist(next: Team[]): void {
  teams = next
  writeJson(teamsPath(), next)
}

export function listTeams(): Team[] {
  teams ??= readJson(teamsPath(), z.array(TeamSchema), [])
  return teams
}

export function getTeam(id: string): Team | null {
  return listTeams().find((team) => team.id === id) ?? null
}

/** `id` nul : crée une équipe. Le chef ne compte jamais parmi les membres. */
export function saveTeam(id: string | null, input: TeamInput): Team {
  const now = new Date().toISOString()
  const memberIds = [...new Set(input.memberIds)].filter((member) => member !== input.chiefId)
  if (id === null) {
    const team: Team = { ...input, memberIds, id: randomUUID(), createdAt: now, updatedAt: now }
    persist([...listTeams(), team])
    return team
  }
  const existing = getTeam(id)
  if (!existing) throw new Error('Équipe introuvable')
  const updated: Team = { ...existing, ...input, memberIds, updatedAt: now }
  persist(listTeams().map((team) => (team.id === id ? updated : team)))
  return updated
}

/** Supprime l'équipe et tout son historique. */
export function removeTeam(id: string): void {
  persist(listTeams().filter((team) => team.id !== id))
  rmSync(teamDirectory(id), { recursive: true, force: true })
}

export function removeAgentFromTeams(agentId: string): void {
  persist(withoutAgent(listTeams(), agentId))
}

export function getTeamConversation(teamId: string, id: string): TeamConversation | null {
  return readJson(conversationPath(teamId, id), TeamConversationSchema, null)
}

export function listTeamConversations(teamId: string): TeamConversationSummary[] {
  let files: string[]
  try {
    files = readdirSync(teamDirectory(teamId))
  } catch {
    return []
  }
  return files
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => {
      const conversation = getTeamConversation(teamId, file.slice(0, -'.json'.length))
      return conversation
        ? [{ id: conversation.id, title: conversation.title, runCount: conversation.runs.length, updatedAt: conversation.updatedAt }]
        : []
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Ajoute une demande traitée à la conversation, en la créant à la première. */
export function appendTeamRun(teamId: string, id: string, run: TeamRunRecord, title?: string): void {
  const existing = getTeamConversation(teamId, id)
  const conversation: TeamConversation = existing
    ? { ...existing, runs: [...existing.runs, run], updatedAt: run.at }
    : { id, teamId, title: title ?? conversationTitle(run.request), runs: [run], createdAt: run.at, updatedAt: run.at }
  writeJson(conversationPath(teamId, id), conversation)
}

export function deleteTeamConversation(teamId: string, id: string): void {
  rmSync(conversationPath(teamId, id), { force: true })
}
