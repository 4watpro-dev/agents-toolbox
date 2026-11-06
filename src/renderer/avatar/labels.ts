import type { Accessory, EyeStyle, GhostShape } from '../../shared/avatar'

export const EYE_LABELS: Record<EyeStyle, string> = {
  oval: 'Ovales',
  round: 'Ronds',
  wide: 'Larges',
  pixel: 'Carrés'
}

export const SHAPE_LABELS: Record<GhostShape, string> = {
  drop: 'Goutte',
  classic: 'Classique',
  round: 'Bulle'
}

export const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: 'Aucun',
  glasses: 'Lunettes',
  headphones: 'Casque',
  bowtie: 'Nœud papillon',
  beanie: 'Bonnet'
}
