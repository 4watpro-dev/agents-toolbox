import type { AvatarState } from '../../shared/avatar'

export interface WidgetFlags {
  dragging: boolean
  hovered: boolean
  /** Réveil en cours : un sursaut, puis un sourire. */
  waking: 'surprised' | 'happy' | null
  /** Une tâche vient de finir : quelques bonds de joie. */
  celebrating: boolean
  /** Une tâche programmée tourne. */
  working: boolean
  /** Un résultat attend d'être lu. */
  badge: boolean
  /** Personne au clavier depuis un moment. */
  away: boolean
}

/** Expression du fantôme de l'icône. La plus récente ou la plus importante l'emporte. */
export function widgetMood(flags: WidgetFlags): AvatarState {
  if (flags.dragging) return 'idle'
  if (flags.hovered) return 'happy'
  if (flags.waking) return flags.waking
  if (flags.celebrating) return 'happy'
  if (flags.working) return 'thinking'
  if (flags.away) return 'sleepy'
  if (flags.badge) return 'happy'
  return 'idle'
}

/** Durées des petites scènes de l'icône, en millisecondes. */
export const WAKE_SURPRISE_MS = 700
export const WAKE_TOTAL_MS = 2000
export const CELEBRATE_MS = 2600
