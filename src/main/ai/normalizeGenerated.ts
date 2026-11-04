import { z } from 'zod'
import { AgentDraftSchema, CATEGORIES, EMPTY_DRAFT, MAX_CATCHPHRASES, type AgentDraft } from '../../shared/agent'
import { ACCESSORIES, DEFAULT_AVATAR, EYE_STYLES, HEAD_SHAPES } from '../../shared/avatar'

/**
 * Forme demandée au modèle. Les sorties structurées n'imposent ni longueur ni
 * intervalle : ces limites sont appliquées ensuite par `normalizeGenerated`.
 */
export const GeneratedAgentSchema = z.object({
  name: z.string().describe('Prénom court et mémorable'),
  specialty: z.string().describe('Spécialité en quelques mots, sans majuscule initiale'),
  category: z.enum(CATEGORIES),
  description: z.string().describe('Une phrase'),
  headColor: z.string().describe('Couleur douce au format #rrggbb'),
  antennaColor: z.string().describe('Couleur vive au format #rrggbb'),
  eyeStyle: z.enum(EYE_STYLES),
  accessory: z.enum(ACCESSORIES),
  headShape: z.enum(HEAD_SHAPES),
  formality: z.number().describe('0 = formel, 100 = décontracté'),
  detail: z.number().describe('0 = concis, 100 = détaillé'),
  humor: z.number().describe('0 = sérieux, 100 = humoristique'),
  boldness: z.number().describe('0 = prudent, 100 = audacieux'),
  tuVous: z.enum(['tu', 'vous']),
  traits: z.array(z.string()).describe('2 à 4 adjectifs'),
  catchphrases: z.array(z.string()).describe('1 à 3 expressions courtes et naturelles, propres à ce personnage'),
  backstory: z.string().describe('2 ou 3 phrases'),
  instructions: z.string().describe("Ce que l'agent fait et comment, en quelques phrases adressées à l'agent en le tutoyant"),
  greeting: z.string().describe("Message d'accueil court, fidèle au ton du personnage")
})

export type GeneratedAgent = z.infer<typeof GeneratedAgentSchema>

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function slider(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) / 5) * 5
}

function color(value: string, fallback: string): string {
  return HEX_COLOR.test(value) ? value : fallback
}

function cleanList(values: string[], maxItems: number, maxLength: number): string[] {
  return values
    .map((value) => value.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

/** Ramène une proposition du modèle dans les limites acceptées par l'app. */
export function normalizeGenerated(generated: GeneratedAgent): AgentDraft {
  return AgentDraftSchema.parse({
    ...EMPTY_DRAFT,
    name: generated.name.trim().slice(0, 40),
    specialty: generated.specialty.trim().slice(0, 80),
    category: generated.category,
    description: generated.description.trim().slice(0, 300),
    avatar: {
      headColor: color(generated.headColor, DEFAULT_AVATAR.headColor),
      antennaColor: color(generated.antennaColor, DEFAULT_AVATAR.antennaColor),
      eyeStyle: generated.eyeStyle,
      accessory: generated.accessory,
      headShape: generated.headShape
    },
    personality: {
      sliders: {
        formality: slider(generated.formality),
        detail: slider(generated.detail),
        humor: slider(generated.humor),
        boldness: slider(generated.boldness)
      },
      tuVous: generated.tuVous,
      traits: cleanList(generated.traits, 12, 40),
      catchphrases: cleanList(generated.catchphrases, MAX_CATCHPHRASES, 120),
      backstory: generated.backstory.trim().slice(0, 800)
    },
    instructions: generated.instructions.trim().slice(0, 8000),
    greeting: generated.greeting.trim().slice(0, 400)
  })
}
