import { z } from 'zod'
import { MAX_MEMBERS, MIN_MEMBERS, teamTranscript } from './team'

export const TeamInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** `null` : le chef a été supprimé, l'équipe attend qu'on en choisisse un autre. */
  chiefId: z.uuid().nullable(),
  memberIds: z.array(z.uuid()).min(MIN_MEMBERS).max(MAX_MEMBERS)
})

export const TeamSchema = TeamInputSchema.extend({
  id: z.uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Une équipe peut perdre tous ses membres si on les supprime : elle reste à compléter.
  memberIds: z.array(z.uuid()).max(MAX_MEMBERS)
})

export type TeamInput = z.infer<typeof TeamInputSchema>
export type Team = z.infer<typeof TeamSchema>

/** Le travail d'un membre pour une demande : la consigne reçue et ce qu'il a produit. */
export const MemberWorkSchema = z.object({
  agentId: z.string(),
  /** Nom au moment du travail : l'agent peut être renommé ou supprimé depuis. */
  name: z.string(),
  task: z.string(),
  text: z.string(),
  problem: z.string().nullable().default(null)
})

/** Une demande traitée par l'équipe, du partage du travail à la réponse finale. */
export const TeamRunRecordSchema = z.object({
  request: z.string(),
  chiefName: z.string(),
  work: z.array(MemberWorkSchema),
  answer: z.string(),
  at: z.string(),
  /** Demande lancée par une tâche programmée. */
  scheduled: z.boolean().default(false)
})

export const TeamConversationSchema = z.object({
  id: z.uuid(),
  teamId: z.uuid(),
  title: z.string(),
  runs: z.array(TeamRunRecordSchema),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type MemberWork = z.infer<typeof MemberWorkSchema>
export type TeamRunRecord = z.infer<typeof TeamRunRecordSchema>
export type TeamConversation = z.infer<typeof TeamConversationSchema>

export interface TeamConversationSummary {
  id: string
  title: string
  runCount: number
  updatedAt: string
}

/** Dernier échange réussi, donné au chef pour une question de suite. */
export function previousFromRuns(runs: TeamRunRecord[]): string | null {
  const last = runs.at(-1)
  return last ? `La personne : ${last.request}\n\nRéponse de l'équipe : ${last.answer}` : null
}

/** Équipe prête à travailler : un chef et au moins un membre qui existent encore. */
export function teamReady(team: Team, agentIds: string[]): boolean {
  return (
    team.chiefId !== null &&
    agentIds.includes(team.chiefId) &&
    team.memberIds.some((id) => id !== team.chiefId && agentIds.includes(id))
  )
}

/** Retire un agent supprimé de toutes les équipes. */
export function withoutAgent(teams: Team[], agentId: string): Team[] {
  return teams.map((team) =>
    team.chiefId === agentId || team.memberIds.includes(agentId)
      ? {
          ...team,
          chiefId: team.chiefId === agentId ? null : team.chiefId,
          memberIds: team.memberIds.filter((id) => id !== agentId),
          updatedAt: new Date().toISOString()
        }
      : team
  )
}

/** Conversation d'équipe recopiée chez le chef, pour qu'il continue seul. */
export function chiefCopyTurns(conversation: TeamConversation, teamName: string): { role: 'user' | 'assistant'; text: string }[] {
  return conversation.runs.flatMap((run) => [
    { role: 'user' as const, text: `[Équipe ${teamName}]\n\n${run.request}` },
    {
      role: 'assistant' as const,
      text: teamTranscript(
        run.answer,
        run.work.map((work) => ({ name: work.name, task: work.task, text: work.text }))
      )
    }
  ])
}
