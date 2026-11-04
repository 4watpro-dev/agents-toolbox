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
  antenna: { rotate: number; glow: 'off' | 'on' | 'pulse'; dimmed?: boolean }
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
    antenna: { rotate: 0, glow: 'off' }
  },
  listening: {
    gaze: { x: 0, y: 0 },
    leftEye: 1.06,
    rightEye: 1.06,
    eyeShape: 'open',
    blinks: true,
    head: { y: 0, rotate: 2 },
    antenna: { rotate: 0, glow: 'on' }
  },
  thinking: {
    gaze: { x: 3, y: -6 },
    leftEye: 0.94,
    rightEye: 0.94,
    eyeShape: 'open',
    blinks: false,
    head: { y: 0, rotate: -3 },
    antenna: { rotate: 0, glow: 'pulse' }
  },
  happy: {
    gaze: { x: 0, y: 0 },
    leftEye: 1,
    rightEye: 1,
    eyeShape: 'arc',
    blinks: false,
    head: { y: -2, rotate: 0 },
    antenna: { rotate: 0, glow: 'on' },
    mouth: 'M53 79 Q60 86 67 79',
    cheeks: true
  },
  surprised: {
    gaze: { x: 0, y: -1 },
    leftEye: 1.25,
    rightEye: 1.25,
    eyeShape: 'open',
    blinks: false,
    head: { y: -3, rotate: 0 },
    antenna: { rotate: 0, glow: 'on' },
    mouth: 'M57 83 a3 3.5 0 1 0 6 0 a3 3.5 0 1 0 -6 0'
  },
  confused: {
    gaze: { x: -3, y: 0 },
    leftEye: 1.1,
    rightEye: 0.78,
    eyeShape: 'open',
    blinks: true,
    head: { y: 0, rotate: -7 },
    antenna: { rotate: 16, glow: 'off' },
    mouth: 'M54 82 q3 -3 6 0 t6 0',
    brows: { left: 'M36 47 L50 45', right: 'M70 50 L84 52' }
  },
  sorry: {
    gaze: { x: 0, y: 4 },
    leftEye: 0.92,
    rightEye: 0.92,
    eyeShape: 'open',
    blinks: true,
    head: { y: 3, rotate: 0 },
    antenna: { rotate: -22, glow: 'off', dimmed: true },
    mouth: 'M53 85 Q60 79 67 85',
    brows: { left: 'M36 53 L50 48', right: 'M70 48 L84 53' }
  }
}
