export const EYE_STYLES = ['oval', 'round', 'wide', 'pixel'] as const
export type EyeStyle = (typeof EYE_STYLES)[number]

export const ACCESSORIES = ['none', 'glasses', 'headphones', 'bowtie', 'beanie'] as const
export type Accessory = (typeof ACCESSORIES)[number]

export const GHOST_SHAPES = ['drop', 'classic', 'round'] as const
export type GhostShape = (typeof GHOST_SHAPES)[number]

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
  /** Teinte du corps du fantôme. */
  bodyColor: string
  /** Couleur du bord lumineux et de l'aura. */
  glowColor: string
  eyeStyle: EyeStyle
  accessory: Accessory
  shape: GhostShape
}

export const DEFAULT_AVATAR: AvatarConfig = {
  bodyColor: '#5be370',
  glowColor: '#ffffff',
  eyeStyle: 'oval',
  accessory: 'none',
  shape: 'drop'
}

const LEGACY_SHAPES: Record<string, GhostShape> = { capsule: 'drop', square: 'classic', round: 'round' }

/**
 * Convertit une fiche créée du temps des robots, en stock ou dans un ancien export.
 * La couleur d'antenne, vive et propre à chaque agent, devient la teinte du corps.
 * Toute autre valeur passe telle quelle : la validation s'en charge.
 */
export function migrateLegacyAvatar(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !('headShape' in value)) return value
  const { headColor: _headColor, antennaColor, headShape, ...rest } = value as Record<string, unknown>
  return {
    ...rest,
    bodyColor: antennaColor,
    glowColor: DEFAULT_AVATAR.glowColor,
    shape: LEGACY_SHAPES[String(headShape)] ?? DEFAULT_AVATAR.shape
  }
}

/** Luminance relative WCAG d'une couleur `#rrggbb` (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Couleur des yeux, de la bouche et des lunettes. Sombre, sauf sur un corps presque noir. */
export function faceColor(bodyColor: string): string {
  return luminance(bodyColor) > 0.05 ? '#20242c' : '#f5f7fa'
}
