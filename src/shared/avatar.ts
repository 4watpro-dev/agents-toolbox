export const EYE_STYLES = ['oval', 'round', 'wide', 'pixel'] as const
export type EyeStyle = (typeof EYE_STYLES)[number]

export const ACCESSORIES = ['none', 'glasses', 'headphones', 'bowtie', 'beanie'] as const
export type Accessory = (typeof ACCESSORIES)[number]

export const HEAD_SHAPES = ['capsule', 'round', 'square'] as const
export type HeadShape = (typeof HEAD_SHAPES)[number]

export const AVATAR_STATES = [
  'idle',
  'listening',
  'thinking',
  'happy',
  'surprised',
  'confused',
  'sorry'
] as const
export type AvatarState = (typeof AVATAR_STATES)[number]

export interface AvatarConfig {
  headColor: string
  antennaColor: string
  eyeStyle: EyeStyle
  accessory: Accessory
  headShape: HeadShape
}

export const DEFAULT_AVATAR: AvatarConfig = {
  headColor: '#ffffff',
  antennaColor: '#3b8cff',
  eyeStyle: 'oval',
  accessory: 'none',
  headShape: 'capsule'
}

/** Luminance relative WCAG d'une couleur `#rrggbb` (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Couleur des yeux, de la bouche et des lunettes : toujours lisible sur la tête. */
export function faceColor(headColor: string): string {
  return luminance(headColor) > 0.18 ? '#20242c' : '#f5f7fa'
}
