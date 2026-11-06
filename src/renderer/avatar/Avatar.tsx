import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { createContext, useContext, useId } from 'react'
import {
  DEFAULT_AVATAR,
  faceColor,
  type Accessory,
  type AvatarConfig,
  type AvatarState,
  type EyeStyle,
  type GhostShape
} from '../../shared/avatar'
import { EXPRESSIONS } from './expressions'
import { useBlink } from './useBlink'
import './avatar.css'

const CX = 60
const CY = 58
const EYE_Y = 42
const EYE_OFFSET = 11
const BODY_TOP = 14

const BODIES: Record<GhostShape, string> = {
  drop: 'M60 14 C85 14 104 33 104 57 C104 78 84 92 63.5 104.5 Q60 106.5 56.5 104.5 C36 92 16 78 16 57 C16 33 35 14 60 14 Z',
  classic:
    'M60 14 C85 14 104 33 104 58 L104 92 Q96.7 108 89.3 92 Q82 80 74.7 92 Q67.3 108 60 92 Q52.7 80 45.3 92 Q38 108 30.7 92 Q23.3 80 16 92 L16 58 C16 33 35 14 60 14 Z',
  round: 'M60 14 C85 14 104 34 104 59 C104 84 85 104 60 104 C35 104 16 84 16 59 C16 34 35 14 60 14 Z'
}

const SPRING = { type: 'spring', stiffness: 260, damping: 20 } as const

/** Vrai quand l'avatar n'est pas visible : plus de clignement, donc plus de rendu inutile. */
export const AvatarPausedContext = createContext(false)

interface AvatarProps {
  config?: AvatarConfig
  state?: AvatarState
  /** Taille en pixels. */
  size?: number
  /** Ombre portée au sol : à retirer quand le parent dessine déjà la sienne. */
  groundShadow?: boolean
  /**
   * Flottement continu. Il force un rendu à chaque image : à couper pour une
   * icône affichée en permanence, où il coûte environ un tiers d'un cœur CPU.
   */
  floating?: boolean
  /** Description lue par les lecteurs d'écran. Sans elle, l'avatar est décoratif. */
  label?: string
}

export function Avatar({
  config = DEFAULT_AVATAR,
  state = 'idle',
  size = 120,
  groundShadow = true,
  floating = true,
  label
}: AvatarProps): React.JSX.Element {
  const expression = EXPRESSIONS[state]
  const paused = useContext(AvatarPausedContext)
  const blinking = useBlink(expression.blinks && !paused)
  const uid = useId()
  const ink = faceColor(config.bodyColor)
  const body = BODIES[config.shape]
  const rimId = `${uid}-rim`
  const bellyId = `${uid}-belly`
  const auraId = `${uid}-aura`
  const clipId = `${uid}-body`

  return (
    <MotionConfig reducedMotion="user">
      <svg
        className="avatar"
        viewBox="0 0 120 120"
        width={size}
        height={size}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      >
        <defs>
          {/* Bord lumineux : le centre laisse voir la teinte, le pourtour devient blanc. */}
          <radialGradient id={rimId} cx="0.5" cy="0.56" r="0.62">
            <stop offset="0.42" stopColor={config.glowColor} stopOpacity="0" />
            <stop offset="0.72" stopColor={config.glowColor} stopOpacity="0.55" />
            <stop offset="0.9" stopColor={config.glowColor} stopOpacity="0.95" />
            <stop offset="1" stopColor={config.glowColor} stopOpacity="1" />
          </radialGradient>
          {/* Nuage clair dans le bas du corps. */}
          <radialGradient id={bellyId}>
            <stop offset="0" stopColor={config.glowColor} stopOpacity="0.62" />
            <stop offset="0.55" stopColor={config.glowColor} stopOpacity="0.42" />
            <stop offset="1" stopColor={config.glowColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={auraId}>
            <stop offset="0.55" stopColor={config.glowColor} stopOpacity="0.7" />
            <stop offset="1" stopColor={config.glowColor} stopOpacity="0" />
          </radialGradient>
          <clipPath id={clipId}>
            <path d={body} />
          </clipPath>
        </defs>

        {groundShadow && <ellipse className="avatar-ground" cx={CX} cy={114} rx={24} ry={3.5} />}

        <g className={floating ? 'avatar-float' : undefined}>
          <motion.g
            animate={{ y: expression.head.y, rotate: expression.head.rotate, opacity: expression.dimmed ? 0.72 : 1 }}
            transition={SPRING}
            style={{ originX: `${CX}px`, originY: `${CY}px`, transformBox: 'view-box' }}
          >
            {expression.aura !== 'off' && (
              <circle
                className={expression.aura === 'pulse' ? 'avatar-aura avatar-aura-pulse' : 'avatar-aura'}
                cx={CX}
                cy={CY}
                r={58}
                fill={`url(#${auraId})`}
              />
            )}

            <path d={body} fill={config.bodyColor} />
            <ellipse cx={CX} cy={76} rx={28} ry={21} fill={`url(#${bellyId})`} clipPath={`url(#${clipId})`} />
            <path d={body} fill={`url(#${rimId})`} />

            {expression.cheeks && (
              <>
                <ellipse cx={CX - 20} cy={53} rx={5} ry={3} fill="#ff8fa3" opacity={0.6} />
                <ellipse cx={CX + 20} cy={53} rx={5} ry={3} fill="#ff8fa3" opacity={0.6} />
              </>
            )}

            <motion.g animate={{ x: expression.gaze.x, y: expression.gaze.y }} transition={SPRING}>
              <Eye
                x={CX - EYE_OFFSET}
                style={config.eyeStyle}
                ink={ink}
                scale={expression.leftEye}
                shape={expression.eyeShape}
                closed={blinking}
              />
              <Eye
                x={CX + EYE_OFFSET}
                style={config.eyeStyle}
                ink={ink}
                scale={expression.rightEye}
                shape={expression.eyeShape}
                closed={blinking}
              />
            </motion.g>

            <AccessoryLayer accessory={config.accessory} ink={ink} clipId={clipId} />

            <AnimatePresence>
              {expression.brows && (
                <motion.g
                  key="brows"
                  fill="none"
                  stroke={ink}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <path d={expression.brows.left} />
                  <path d={expression.brows.right} />
                </motion.g>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {expression.mouth && (
                <motion.path
                  key={expression.mouth}
                  d={expression.mouth}
                  fill="none"
                  stroke={ink}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>
          </motion.g>
        </g>
      </svg>
    </MotionConfig>
  )
}

interface EyeProps {
  x: number
  style: EyeStyle
  ink: string
  scale: number
  shape: 'open' | 'arc'
  closed: boolean
}

function Eye({ x, style, ink, scale, shape, closed }: EyeProps): React.JSX.Element {
  if (shape === 'arc') {
    return (
      <path
        d={`M${x - 6} ${EYE_Y + 2} Q${x} ${EYE_Y - 8} ${x + 6} ${EYE_Y + 2}`}
        fill="none"
        stroke={ink}
        strokeWidth={3}
        strokeLinecap="round"
      />
    )
  }
  return (
    <motion.g
      initial={false}
      animate={{ scaleX: scale, scaleY: closed ? 0.08 : scale }}
      transition={closed ? { duration: 0.05 } : { duration: 0.09 }}
      style={{ originX: `${x}px`, originY: `${EYE_Y}px`, transformBox: 'view-box' }}
    >
      <EyeShape x={x} style={style} ink={ink} />
    </motion.g>
  )
}

function EyeShape({ x, style, ink }: { x: number; style: EyeStyle; ink: string }): React.JSX.Element {
  switch (style) {
    case 'oval':
      return <ellipse cx={x} cy={EYE_Y} rx={5} ry={7} fill={ink} />
    case 'round':
      return <circle cx={x} cy={EYE_Y} r={6} fill={ink} />
    case 'wide':
      return <ellipse cx={x} cy={EYE_Y} rx={7} ry={5} fill={ink} />
    case 'pixel':
      return <rect x={x - 4.5} y={EYE_Y - 6} width={9} height={12} rx={2.5} fill={ink} />
  }
}

interface AccessoryLayerProps {
  accessory: Accessory
  ink: string
  clipId: string
}

function AccessoryLayer({ accessory, ink, clipId }: AccessoryLayerProps): React.JSX.Element | null {
  switch (accessory) {
    case 'none':
      return null
    case 'glasses':
      return (
        <g fill="none" stroke={ink} strokeWidth={2}>
          <circle cx={CX - EYE_OFFSET} cy={EYE_Y} r={9.5} />
          <circle cx={CX + EYE_OFFSET} cy={EYE_Y} r={9.5} />
          <path d={`M${CX - 1.5} ${EYE_Y - 1} Q${CX} ${EYE_Y - 2.5} ${CX + 1.5} ${EYE_Y - 1}`} />
        </g>
      )
    case 'headphones':
      return (
        <g>
          <path d="M13 50 C13 -6 107 -6 107 50" fill="none" stroke="#8a93a6" strokeWidth={4} strokeLinecap="round" />
          <rect x={7} y={40} width={12} height={26} rx={6} fill="#8a93a6" />
          <rect x={101} y={40} width={12} height={26} rx={6} fill="#8a93a6" />
        </g>
      )
    case 'bowtie': {
      const y = 76
      return (
        <g fill="#d64550">
          <path d={`M${CX} ${y} L${CX - 13} ${y - 7} Q${CX - 15} ${y} ${CX - 13} ${y + 7} Z`} />
          <path d={`M${CX} ${y} L${CX + 13} ${y - 7} Q${CX + 15} ${y} ${CX + 13} ${y + 7} Z`} />
          <rect x={CX - 3} y={y - 3.5} width={6} height={7} rx={2} fill="#a8323d" />
        </g>
      )
    }
    case 'beanie':
      return (
        <g clipPath={`url(#${clipId})`}>
          <rect x={0} y={BODY_TOP} width={120} height={17} fill="#e4572e" />
          <rect x={0} y={BODY_TOP + 13} width={120} height={5} fill="#b83f1d" />
        </g>
      )
  }
}
