import type { AvatarState } from '../../shared/avatar'

export interface Expression {
  /** Regard : décalage des deux yeux dans la grille de 120 unités. */
  gaze: { x: number; y: number }
  leftEye: number
  rightEye: number
  /** `arc` remplace les yeux par deux arcs souriants. */
  eyeShape: 'open' | 'arc'
  blinks: boolean
  head: { y: number; rotate: number }
  /** Aura derrière le fantôme : fixe à l'écoute, pulsée pendant la réflexion. */
  aura: 'off' | 'on' | 'pulse'
  /** Le fantôme devient plus transparent. */
  dimmed?: boolean
  mouth?: string
  brows?: { left: string; right: string }
  cheeks?: boolean
}

export const EXPRESSIONS: Record<AvatarState, Expression> = {
  idle: {
    gaze: { x: 0, y: 0 },
    leftEye: 1,
    rightEye: 1,
    eyeShape: 'open',
    blinks: true,
    head: { y: 0, rotate: 0 },
    aura: 'off'
  },
  listening: {
    gaze: { x: 0, y: 0 },
    leftEye: 1.06,
    rightEye: 1.06,
    eyeShape: 'open',
    blinks: true,
    head: { y: 0, rotate: 2 },
    aura: 'on'
  },
  thinking: {
    gaze: { x: 2.5, y: -4 },
    leftEye: 0.94,
    rightEye: 0.94,
    eyeShape: 'open',
    blinks: false,
    head: { y: 0, rotate: -3 },
    aura: 'pulse'
  },
  happy: {
    gaze: { x: 0, y: 0 },
    leftEye: 1,
    rightEye: 1,
    eyeShape: 'arc',
    blinks: false,
    head: { y: -2, rotate: 0 },
    aura: 'on',
    mouth: 'M54 56 Q60 62 66 56',
    cheeks: true
  },
  surprised: {
    gaze: { x: 0, y: -1 },
    leftEye: 1.25,
    rightEye: 1.25,
    eyeShape: 'open',
    blinks: false,
    head: { y: -3, rotate: 0 },
    aura: 'on',
    mouth: 'M57 60 a3 3.5 0 1 0 6 0 a3 3.5 0 1 0 -6 0'
  },
  confused: {
    gaze: { x: -2, y: 0 },
    leftEye: 1.1,
    rightEye: 0.78,
    eyeShape: 'open',
    blinks: true,
    head: { y: 0, rotate: -7 },
    aura: 'off',
    mouth: 'M54 60 q3 -3 6 0 t6 0',
    brows: { left: 'M41 29 L52 27', right: 'M68 31 L79 33' }
  },
  sorry: {
    gaze: { x: 0, y: 3 },
    leftEye: 0.92,
    rightEye: 0.92,
    eyeShape: 'open',
    blinks: true,
    head: { y: 3, rotate: 0 },
    aura: 'off',
    dimmed: true,
    mouth: 'M54 62 Q60 56 66 62',
    brows: { left: 'M42 33 L52 29', right: 'M68 29 L78 33' }
  }
}
