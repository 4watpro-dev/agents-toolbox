// Logique de l'équipe d'agents : le chef répartit, les membres travaillent, le chef synthétise.

export interface TeamMember {
  id: string
  name: string
  specialty: string
  description: string
}

export interface Assignment {
  agentId: string
  task: string
}

export interface Contribution {
  name: string
  task: string
  /** Vide si le membre a échoué. */
  text: string
}

export const MIN_MEMBERS = 1
export const MAX_MEMBERS = 4

/** Ce que le chef reçoit pour répartir le travail. */
export function planPrompt(request: string, members: TeamMember[], previous: string | null): string {
  const roster = members.map((member) => `- ${member.name} (${member.specialty}) : ${member.description}`).join('\n')
  return [
    'Tu diriges une équipe d’agents pour répondre à la personne. Voici ton équipe :',
    roster,
    ...(previous ? ['', 'Pour le contexte, voici le dernier échange de l’équipe avec la personne :', previous] : []),
    '',
    'Sa demande :',
    `« ${request} »`,
    '',
    'Répartis le travail : écris une ligne par membre utile, de la forme',
    '@Nom : consigne',
    'La consigne doit se suffire à elle-même : le membre ne voit que la demande, sa consigne et le travail des membres passés avant lui. Ordonne les lignes dans l’ordre où ils doivent travailler.',
    'Ne fais appel qu’aux membres utiles. Si la demande ne demande aucun d’eux, écris seulement « @aucun ».',
    'Réponds uniquement avec ces lignes, sans autre texte.'
  ].join('\n')
}

const normalize = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/**
 * Lit la répartition du chef. Un nom inconnu est ignoré ; un membre cité deux fois
 * reçoit ses consignes réunies. Aucune ligne valide : le chef répondra seul.
 */
export function parsePlan(text: string, members: TeamMember[]): Assignment[] {
  const byName = new Map(members.map((member) => [normalize(member.name), member]))
  const assignments: Assignment[] = []
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*[-*]?\s*@\s*([^:]+?)\s*:\s*(.+?)\s*$/)
    if (!match) continue
    const member = byName.get(normalize(match[1]!.replace(/[*_`]/g, '')))
    if (!member) continue
    const existing = assignments.find((assignment) => assignment.agentId === member.id)
    if (existing) existing.task = `${existing.task}\n${match[2]}`
    else assignments.push({ agentId: member.id, task: match[2]! })
  }
  return assignments
}

/** Ce qu'un membre reçoit : la demande, sa mission, et ce que les autres ont déjà produit. */
export function memberPrompt(request: string, chiefName: string, task: string, before: Contribution[]): string {
  const done = before.filter((contribution) => contribution.text)
  return [
    `${chiefName}, qui dirige l’équipe, te confie une partie de cette demande de la personne :`,
    `« ${request} »`,
    '',
    'Ta mission :',
    task,
    ...(done.length > 0
      ? ['', 'Travail déjà fait par l’équipe :', ...done.map((contribution) => `\n### ${contribution.name}\n${contribution.text}`)]
      : []),
    '',
    'Réponds directement avec ton travail, sans préambule. Il sera transmis à ' + chiefName + ', qui fera la synthèse.'
  ].join('\n')
}

/** Ce que le chef reçoit pour rédiger la réponse finale. */
export function synthesisPrompt(request: string, contributions: Contribution[]): string {
  return [
    'Voici la demande de la personne :',
    `« ${request} »`,
    '',
    'Et le travail de ton équipe :',
    ...contributions.map((contribution) =>
      contribution.text
        ? `\n### ${contribution.name} (mission : ${contribution.task})\n${contribution.text}`
        : `\n### ${contribution.name}\n(n’a pas pu répondre)`
    ),
    '',
    'Rédige la réponse finale pour la personne : rassemble, harmonise et corrige si besoin. Dis brièvement qui a apporté quoi quand c’est utile. Ne recopie pas tout tel quel.'
  ].join('\n')
}

/** Version enregistrée dans l'historique du chef : la réponse, puis les contributions. */
export function teamTranscript(answer: string, contributions: Contribution[]): string {
  const parts = contributions
    .filter((contribution) => contribution.text)
    .map((contribution) => `#### ${contribution.name}\n\n${contribution.text}`)
  return parts.length > 0 ? `${answer}\n\n---\n\n### Contributions de l’équipe\n\n${parts.join('\n\n')}` : answer
}

