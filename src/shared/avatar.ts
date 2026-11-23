export const EYE_STYLES = ['oval', 'round', 'wide', 'pixel'] as const
export type EyeStyle = (typeof EYE_STYLES)[number]

export const ACCESSORIES = ['none', 'glasses', 'headphones', 'bowtie', 'beanie'] as const
export type Accessory = (typeof ACCESSORIES)[number]

export const GHOST_SHAPES = ['drop', 'classic', 'round', 'sheet'] as const
export type GhostShape = (typeof GHOST_SHAPES)[number]

export const AVATAR_STATES = [
  'idle',
  'listening',
  'thinking',
  'happy',
  'surprised',
  'confused',
  'sorry',
  'sleepy'
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

type Rgb = [number, number, number]

const toRgb = (hex: string): Rgb => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as Rgb
const toHex = (rgb: Rgb): string =>
  `#${rgb.map((c) => Math.round(Math.min(Math.max(c, 0), 255)).toString(16).padStart(2, '0')).join('')}`

/** Mélange deux couleurs `#rrggbb` : 0 donne `a`, 1 donne `b`. */
export function mixColor(a: string, b: string, t: number): string {
  const from = toRgb(a)
  const to = toRgb(b)
  return toHex(from.map((c, i) => c + (to[i]! - c) * t) as Rgb)
}

type Hsl = [number, number, number]

/** Au-delà, le cœur est trop clair pour des yeux blancs (sauf fantôme quasi blanc). */
const CORE_MAX_LUMINANCE = 0.3

function toHsl(hex: string): Hsl {
  const [r, g, b] = toRgb(hex).map((c) => c / 255) as Rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (max + min) / 2
  const delta = max - min
  if (delta === 0) return [0, 0, light]
  const sat = delta / (1 - Math.abs(2 * light - 1))
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return [(hue * 60 + 360) % 360, sat, light]
}

function fromHsl([hue, sat, light]: Hsl): string {
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = light - chroma / 2
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x]
  ][Math.floor(hue / 60) % 6]!
  return toHex([(r! + m) * 255, (g! + m) * 255, (b! + m) * 255])
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1)

/** Décale teinte (degrés), saturation et luminosité (de -1 à 1) d'une couleur. Un gris reste gris. */
export function adjustColor(hex: string, { hue = 0, sat = 0, light = 0 }: { hue?: number; sat?: number; light?: number }): string {
  const [h, s, l] = toHsl(hex)
  return fromHsl([(((h + hue) % 360) + 360) % 360, s === 0 ? 0 : clamp01(s + sat), clamp01(l + light)])
}

/** Tourne la teinte d'une couleur sur le cercle chromatique, en degrés. */
export function shiftHue(hex: string, degrees: number): string {
  return adjustColor(hex, { hue: degrees })
}

/** Couleurs du fantôme en verre teinté, toutes dérivées de sa fiche. */
export interface GlassPalette {
  /** Cœur foncé, derrière les yeux. */
  core: string
  /** Teinte choisie, à mi-chemin du bord. */
  body: string
  /** Bord givré, plus clair. */
  edge: string
  /** Reflet du bas : une teinte voisine, plus vive et plus claire. */
  reflection: string
  /** Yeux, bouche et lunettes. */
  ink: string
}

/**
 * Cœur du verre : plus sombre mais plus saturé, pour rester vif. Les teintes très
 * lumineuses (vert, jaune) sont assombries davantage, pour que les yeux blancs ressortent.
 */
function coreColor(bodyColor: string): string {
  // Fantôme quasi blanc : un verre givré à peine ombré, avec des yeux sombres.
  if (luminance(bodyColor) > 0.75) return adjustColor(bodyColor, { light: -0.12 })
  const light = toHsl(bodyColor)[2]
  let core = adjustColor(bodyColor, { sat: 0.25, light: -light * 0.28 })
  for (let step = 0; step < 4 && luminance(core) > CORE_MAX_LUMINANCE; step++) {
    core = adjustColor(core, { light: -0.05 })
  }
  return core
}

export function glassPalette(bodyColor: string, glowColor: string): GlassPalette {
  return {
    core: coreColor(bodyColor),
    body: bodyColor,
    edge: mixColor(bodyColor, glowColor, 0.55),
    reflection: adjustColor(bodyColor, { hue: -55, sat: 0.2, light: 0.14 }),
    ink: faceColor(bodyColor)
  }
}

/**
 * Couleur des yeux, de la bouche et des lunettes. Le visage repose sur le cœur
 * foncé du verre : blanc, sauf sur un fantôme très clair.
 */
export function faceColor(bodyColor: string): string {
  return luminance(coreColor(bodyColor)) > CORE_MAX_LUMINANCE + 0.05 ? '#20242c' : '#ffffff'
}
