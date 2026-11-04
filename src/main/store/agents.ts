import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { AgentSchema, type Agent, type AgentDraft } from '../../shared/agent'
import { readJson, writeJson } from './jsonFile'
import { SEED_AGENTS } from './seedAgents'

const agentsPath = (): string => join(app.getPath('userData'), 'agents.json')

let agents: Agent[] | null = null

function create(draft: AgentDraft): Agent {
  const now = new Date().toISOString()
  return { ...draft, id: randomUUID(), createdAt: now, updatedAt: now }
}

function persist(next: Agent[]): void {
  agents = next
  writeJson(agentsPath(), next)
}

export function listAgents(): Agent[] {
  if (agents) return agents
  // Seul un premier lancement reçoit les exemples : un fichier vide veut dire
  // que tout a été supprimé, et ces suppressions doivent être respectées.
  if (!existsSync(agentsPath())) {
    persist(SEED_AGENTS.map(create))
    return agents!
  }
  agents = readJson(agentsPath(), z.array(AgentSchema), [])
  return agents
}

export function saveAgent(id: string | null, draft: AgentDraft): Agent {
  const all = listAgents()
  if (id === null) {
    const agent = create(draft)
    persist([...all, agent])
    return agent
  }
  const existing = all.find((agent) => agent.id === id)
  if (!existing) throw new Error('Agent introuvable.')
  const agent: Agent = { ...draft, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
  persist(all.map((other) => (other.id === id ? agent : other)))
  return agent
}

export function setFavorite(id: string, isFavorite: boolean): Agent {
  const existing = listAgents().find((agent) => agent.id === id)
  if (!existing) throw new Error('Agent introuvable.')
  const agent = { ...existing, isFavorite }
  persist(listAgents().map((other) => (other.id === id ? agent : other)))
  return agent
}

export function removeAgent(id: string): void {
  persist(listAgents().filter((agent) => agent.id !== id))
}
