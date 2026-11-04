import { z } from 'zod'
import { ACCESSORIES, DEFAULT_AVATAR, EYE_STYLES, HEAD_SHAPES } from './avatar'

export const CATEGORIES = ['Travail', 'Écriture', 'Code', 'Perso', 'Autre'] as const

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Équilibré, recommandé' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Le plus capable, plus cher' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Le plus rapide, très économique' }
] as const

export const EFFORTS = [
  { id: 'low', label: 'Rapide' },
  { id: 'medium', label: 'Équilibré' },
  { id: 'high', label: 'Approfondi' }
] as const

export const SUGGESTED_TRAITS = [
  'curieux',
  'encourageant',
  'direct',
  'pince-sans-rire',
  'perfectionniste',
  'patient',
  'enthousiaste',
  'méthodique',
  'bienveillant',
  'taquin'
] as const

export const MAX_CATCHPHRASES = 3

const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i)
const SliderSchema = z.number().int().min(0).max(100)

const AvatarConfigSchema = z.object({
  headColor: ColorSchema,
  antennaColor: ColorSchema,
  eyeStyle: z.enum(EYE_STYLES),
  accessory: z.enum(ACCESSORIES),
  headShape: z.enum(HEAD_SHAPES)
})

export const AgentDraftSchema = z.object({
  name: z.string().trim().min(1).max(40),
  specialty: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(30),
  description: z.string().trim().max(300),
  avatar: AvatarConfigSchema,
  personality: z.object({
    sliders: z.object({
      formality: SliderSchema,
      detail: SliderSchema,
      humor: SliderSchema,
      boldness: SliderSchema
    }),
    tuVous: z.enum(['tu', 'vous']),
    traits: z.array(z.string().trim().min(1).max(40)).max(12),
    catchphrases: z.array(z.string().trim().min(1).max(120)).max(MAX_CATCHPHRASES),
    backstory: z.string().trim().max(800)
  }),
  instructions: z.string().trim().max(8000),
  model: z.enum(MODELS.map((model) => model.id) as [string, ...string[]]),
  effort: z.enum(['low', 'medium', 'high']),
  greeting: z.string().trim().max(400),
  isFavorite: z.boolean(),
  /** Prompt saisi à la main en mode avancé. Absent : prompt assemblé automatiquement. */
  systemPromptOverride: z.string().trim().min(1).max(12000).optional()
})

export const AgentSchema = AgentDraftSchema.extend({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type AgentDraft = z.infer<typeof AgentDraftSchema>
export type Agent = z.infer<typeof AgentSchema>

export const EMPTY_DRAFT: AgentDraft = {
  name: '',
  specialty: '',
  category: 'Travail',
  description: '',
  avatar: DEFAULT_AVATAR,
  personality: {
    sliders: { formality: 50, detail: 50, humor: 50, boldness: 50 },
    tuVous: 'tu',
    traits: [],
    catchphrases: [],
    backstory: ''
  },
  instructions: '',
  model: 'claude-sonnet-5-5',
  effort: 'low',
  greeting: '',
  isFavorite: false
}

export function toDraft(agent: Agent): AgentDraft {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = agent
  return draft
}
