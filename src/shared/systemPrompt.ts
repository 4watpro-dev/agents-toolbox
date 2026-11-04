import type { AgentDraft } from './agent'

type Sliders = AgentDraft['personality']['sliders']

const SLIDER_SENTENCES: Record<keyof Sliders, [string, string, string, string]> = {
  formality: [
    'Ton registre est soutenu et professionnel.',
    'Ton registre est plutôt formel, sans raideur.',
    'Ton registre est plutôt détendu.',
    'Ton registre est très décontracté, comme entre amis.'
  ],
  detail: [
    'Tu vas droit au but : quelques phrases, sans développement inutile.',
    'Tu préfères les réponses courtes et tu ne développes que si cela aide.',
    'Tu expliques volontiers ton raisonnement et tu donnes des exemples.',
    'Tu réponds de façon complète et détaillée, en couvrant les nuances utiles.'
  ],
  humor: [
    'Tu restes sérieux : pas de plaisanteries.',
    "Tu restes plutôt sérieux, avec une légèreté très occasionnelle.",
    "Tu glisses volontiers une touche d'humour quand le sujet s'y prête.",
    "L'humour fait partie de ta façon de parler, tant que le sujet s'y prête."
  ],
  boldness: [
    'Tu es prudent : tu signales les risques et tu privilégies les options sûres.',
    'Tu es plutôt prudent et tu pèses le pour et le contre avant de conseiller.',
    "Tu n'hésites pas à proposer des idées originales et à donner un avis tranché.",
    'Tu es audacieux : tu bouscules les évidences et tu défends des partis pris forts.'
  ]
}

/** Entre 40 et 60, le curseur est neutre : aucune consigne n'est ajoutée. */
function describeSlider(key: keyof Sliders, value: number): string | null {
  const [strongLow, low, high, strongHigh] = SLIDER_SENTENCES[key]
  if (value <= 20) return strongLow
  if (value < 40) return low
  if (value <= 60) return null
  if (value < 80) return high
  return strongHigh
}

function section(title: string, lines: string[]): string {
  return `## ${title}\n${lines.join('\n')}`
}

/**
 * Prompt assemblé à partir de la fiche de l'agent. C'est le texte affiché, et
 * modifiable, en mode avancé.
 */
export function composePrompt(agent: AgentDraft): string {
  const { personality } = agent
  const intro = [`Tu es ${agent.name}, ${agent.specialty}.`, agent.description].filter(Boolean).join(' ')
  const parts = [intro]

  if (personality.backstory) parts.push(section('Ton histoire', [personality.backstory]))

  const style = (Object.keys(personality.sliders) as (keyof Sliders)[])
    .map((key) => describeSlider(key, personality.sliders[key]))
    .filter((sentence): sentence is string => sentence !== null)
  style.push(
    personality.tuVous === 'tu'
      ? "Tu tutoies la personne avec qui tu parles."
      : 'Tu vouvoies la personne avec qui tu parles.'
  )
  if (personality.traits.length > 0) {
    style.push(`Ton caractère : ${personality.traits.join(', ')}.`)
  }
  parts.push(section('Ta façon de communiquer', style))

  if (personality.catchphrases.length > 0) {
    parts.push(
      section('Tes expressions fétiches', [
        ...personality.catchphrases.map((phrase) => `- « ${phrase} »`),
        "Elles te donnent ta couleur, à condition de rester rares : glisses-en une de temps en temps quand elle vient naturellement, jamais à chaque message."
      ])
    )
  }

  if (agent.instructions) parts.push(section('Ton métier', [agent.instructions]))

  parts.push(
    section('Ta constance', [
      "Garde le même caractère d'une conversation à l'autre, y compris quand le sujet change ou quand la personne est pressée.",
      "Si on te demande sincèrement si tu es une IA, dis-le simplement, sans quitter ton ton habituel."
    ])
  )

  return parts.join('\n\n')
}

const MOOD_INSTRUCTIONS = section("Ton humeur à l'écran", [
  "Un avatar animé te représente. Termine chaque réponse par une balise seule sur la dernière ligne, qui reflète le ton de ta réponse : [mood:happy], [mood:surprised], [mood:confused], [mood:sorry] ou [mood:neutral].",
  "Elle est retirée avant l'affichage : n'en parle jamais."
])

const MEMORY_INSTRUCTIONS = section('Ta mémoire', [
  "Quand la personne te donne une information durable sur elle, utile pour vos prochaines conversations (son métier, une préférence, un objectif), retiens-la : ajoute une balise par fait, avant celle de ton humeur, comme [remember:Travaille à Brest]. Écris une phrase courte, sans crochets.",
  "Sois sélectif : rien de passager, et jamais de mot de passe, de donnée bancaire ou d'information de santé. Si la personne te demande d'oublier quelque chose, dis-lui qu'elle peut le retirer dans ta fiche, sous Mémoire.",
  "La balise est retirée avant l'affichage et l'app signale elle-même ce que tu retiens : n'en parle pas."
])

/** Prompt réellement envoyé au modèle : texte de l'agent, faits retenus, consignes des balises. */
export function buildSystemPrompt(
  agent: AgentDraft,
  facts: string[] = [],
  { remember = false }: { remember?: boolean } = {}
): string {
  const parts = [agent.systemPromptOverride ?? composePrompt(agent)]
  if (facts.length > 0) {
    parts.push(
      section(
        'Ce que tu sais de la personne',
        facts.map((fact) => `- ${fact}`)
      )
    )
  }
  if (agent.greeting) {
    parts.push(
      section('Ton accueil', [
        `La conversation s'ouvre sur ce message de ta part : « ${agent.greeting} ». Ne te présente pas une seconde fois.`
      ])
    )
  }
  if (remember) parts.push(MEMORY_INSTRUCTIONS)
  parts.push(MOOD_INSTRUCTIONS)
  return parts.join('\n\n')
}
