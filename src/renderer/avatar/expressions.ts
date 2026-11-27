import type { AvatarState } from '../../shared/avatar'

export interface Expression {
  /** Regard : décalage des deux yeux dans la grille de 120 unités. */
  gaze: { x: number; y: number }
  leftEye: number
  rightEye: number
  /** `arc` : deux arcs souriants. `closed` : paupières baissées, l'agent dort. */
  eyeShape: 'open' | 'arc' | 'closed'
  blinks: boolean
  head: { y: number; rotate: number }
  /** Aura derrière l'agent : fixe à l'écoute, pulsée pendant la réflexion. */
  aura: 'off' | 'on' | 'pulse'
  /** L'agent devient plus transparent. */
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
    mouth: 'M54 62 Q60 68 66 62',
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
    mouth: 'M57 66 a3 3.5 0 1 0 6 0 a3 3.5 0 1 0 -6 0'
  },
  confused: {
    gaze: { x: -2, y: 0 },
    leftEye: 1.1,
    rightEye: 0.78,
    eyeShape: 'open',
    blinks: true,
    head: { y: 0, rotate: -7 },
    aura: 'off',
    mouth: 'M54 66 q3 -3 6 0 t6 0',
    brows: { left: 'M41 35 L52 33', right: 'M68 37 L79 39' }
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
    mouth: 'M54 68 Q60 62 66 68',
    brows: { left: 'M42 39 L52 35', right: 'M68 35 L78 39' }
  },
  // Personne au clavier depuis un moment : l'agent s'assoupit.
  sleepy: {
    gaze: { x: 0, y: 2 },
    leftEye: 1,
    rightEye: 1,
    eyeShape: 'closed',
    blinks: false,
    head: { y: 3, rotate: 6 },
    aura: 'off',
    dimmed: true,
    mouth: 'M58 64 Q60 65.5 62 64'
  }
}
