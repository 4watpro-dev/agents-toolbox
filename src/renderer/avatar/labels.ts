import type { Accessory, EyeStyle, HeadShape } from '../../shared/avatar'

export const EYE_LABELS: Record<EyeStyle, string> = {
  oval: 'Ovales',
  round: 'Ronds',
  wide: 'Larges',
  pixel: 'Carrés'
}

export const HEAD_LABELS: Record<HeadShape, string> = {
  capsule: 'Capsule',
  round: 'Ronde',
  square: 'Carrée'
}

export const ACCESSORY_LABELS: Record<Accessory, string> = {
  none: 'Aucun',
  glasses: 'Lunettes',
  headphones: 'Casque',
  bowtie: 'Nœud papillon',
  beanie: 'Bonnet'
}
