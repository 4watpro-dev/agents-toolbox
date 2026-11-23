import { describe, expect, it } from 'vitest'
import { memberPrompt, parsePlan, planPrompt, synthesisPrompt, teamTranscript } from './team'

const members = [
  { id: 'p', name: 'Plume', specialty: 'rédacteur', description: 'Écrit des biographies.' },
  { id: 'd', name: 'DRpro', specialty: 'prompts', description: 'Crée des prompts.' },
  { id: 'e', name: 'Élise', specialty: 'traductrice', description: 'Traduit.' }
]

describe('parsePlan', () => {
  it('lit une ligne par membre, dans l’ordre donné', () => {
    const plan = parsePlan('@DRpro : écris le prompt\n@Plume: relis-le', members)
    expect(plan).toEqual([
      { agentId: 'd', task: 'écris le prompt' },
      { agentId: 'p', task: 'relis-le' }
    ])
  })

  it('tolère puces, gras, casse et accents, ignore le reste', () => {
    const plan = parsePlan('Voici le plan :\n- @**plume** : rédige\n* @elise : traduis\n@Inconnu : rien\n@aucun', members)
    expect(plan.map((assignment) => assignment.agentId)).toEqual(['p', 'e'])
  })

  it('réunit les consignes d’un membre cité deux fois', () => {
    expect(parsePlan('@Plume : un\n@Plume : deux', members)).toEqual([{ agentId: 'p', task: 'un\ndeux' }])
  })

  it('ne trouve rien quand le chef garde la main', () => {
    expect(parsePlan('@aucun', members)).toEqual([])
    expect(parsePlan('Je réponds moi-même.', members)).toEqual([])
  })
})

describe('consignes', () => {
  it('donne au chef la liste de l’équipe et le format attendu', () => {
    const prompt = planPrompt('Une bio', members, null)
    expect(prompt).toContain('- Plume (rédacteur) : Écrit des biographies.')
    expect(prompt).toContain('@Nom : consigne')
    expect(prompt).not.toContain('dernier échange')
  })

  it('transmet à un membre le travail déjà fait, sans les échecs', () => {
    const prompt = memberPrompt('Une bio', 'Mailo', 'Relis', [
      { name: 'DRpro', task: 'écris', text: 'Brouillon' },
      { name: 'Élise', task: 'traduis', text: '' }
    ])
    expect(prompt).toContain('### DRpro\nBrouillon')
    expect(prompt).not.toContain('Élise')
  })

  it('signale au chef un membre qui n’a pas répondu', () => {
    expect(synthesisPrompt('Une bio', [{ name: 'Plume', task: 'rédige', text: '' }])).toContain('(n’a pas pu répondre)')
  })
})

describe('teamTranscript', () => {
  it('garde la réponse puis les contributions', () => {
    const transcript = teamTranscript('Final', [{ name: 'Plume', task: 'rédige', text: 'Texte' }])
    expect(transcript).toBe('Final\n\n---\n\n### Contributions de l’équipe\n\n#### Plume\n\nTexte')
    expect(teamTranscript('Final', [])).toBe('Final')
  })
})
