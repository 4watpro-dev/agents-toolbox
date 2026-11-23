import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { createContext, useContext, useId } from 'react'
import {
  DEFAULT_AVATAR,
  glassPalette,
  mixColor,
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
  round: 'M60 14 C85 14 104 34 104 59 C104 84 85 104 60 104 C35 104 16 84 16 59 C16 34 35 14 60 14 Z',
  // Drap : dôme en demi-cercle, côtés droits, bas plat aux coins arrondis.
  sheet: 'M22 51 A38 38 0 0 1 98 51 L98 98 Q98 107 89 107 L31 107 Q22 107 22 98 Z'
}

/**
 * Bord du drap relevé à gauche : il part du flanc, forme une bosse, puis redescend
 * en S jusqu'au bas, aux deux tiers de la largeur. Dessous, on voit l'envers, plus sombre.
 */
const SHEET_EDGE = 'M22 90 C27 86 32 84.4 36.4 84.4 C44 84.4 50 89 56 95 C62 101 68 106 75 107'
const SHEET_FOLD = `${SHEET_EDGE} L75 112 L16 112 L16 90 Z`

/** Reflet coloré du bas, posé sur la partie la plus large de chaque forme. */
const REFLECTIONS: Record<GhostShape, { cy: number; rx: number; ry: number }> = {
  drop: { cy: 94, rx: 30, ry: 20 },
  classic: { cy: 102, rx: 48, ry: 20 },
  round: { cy: 104, rx: 40, ry: 22 },
  sheet: { cy: 104, rx: 30, ry: 16 }
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
  const palette = glassPalette(config.bodyColor, config.glowColor)
  const ink = palette.ink
  const body = BODIES[config.shape]
  const reflection = REFLECTIONS[config.shape]
  const fillId = `${uid}-fill`
  const reflectionId = `${uid}-reflection`
  const glossId = `${uid}-gloss`
  const groundId = `${uid}-ground`
  const foldId = `${uid}-fold`
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
        {/*
          Verre teinté, sans filtre de flou (coûteux à chaque image animée) :
          tout le relief vient de dégradés.
        */}
        <defs>
          {/* Cœur foncé derrière les yeux, bord givré plus clair. */}
          <radialGradient id={fillId} cx="0.5" cy="0.42" r="0.6">
            <stop offset="0" stopColor={palette.core} />
            <stop offset="0.5" stopColor={palette.body} />
            <stop offset="0.82" stopColor={palette.edge} />
            <stop offset="1" stopColor={mixColor(palette.edge, '#ffffff', 0.35)} />
          </radialGradient>
          {/* Lumière qui traverse le verre et ressort par le bas. */}
          <radialGradient id={reflectionId}>
            <stop offset="0.35" stopColor={palette.reflection} stopOpacity="0.95" />
            <stop offset="0.7" stopColor={palette.reflection} stopOpacity="0.45" />
            <stop offset="1" stopColor={palette.reflection} stopOpacity="0" />
          </radialGradient>
          {/* Voile brillant du haut. */}
          <radialGradient id={glossId}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          {/* Envers du drap : ombré sous le bord, un peu moins vers le bas. */}
          <linearGradient id={foldId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mixColor(palette.core, '#000000', 0.55)} stopOpacity="0.95" />
            <stop offset="1" stopColor={mixColor(palette.core, '#000000', 0.25)} stopOpacity="0.9" />
          </linearGradient>
          {/* Halo coloré au sol, à la place d'une ombre grise. */}
          <radialGradient id={groundId}>
            <stop offset="0" stopColor={palette.reflection} stopOpacity="0.5" />
            <stop offset="0.5" stopColor={palette.body} stopOpacity="0.22" />
            <stop offset="1" stopColor={palette.body} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={auraId}>
            <stop offset="0.55" stopColor={config.glowColor} stopOpacity="0.7" />
            <stop offset="1" stopColor={config.glowColor} stopOpacity="0" />
          </radialGradient>
          <clipPath id={clipId}>
            <path d={body} />
          </clipPath>
        </defs>

        {groundShadow && <ellipse cx={CX} cy={112} rx={34} ry={8} fill={`url(#${groundId})`} />}

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

            <path d={body} fill={`url(#${fillId})`} />
            <g clipPath={`url(#${clipId})`}>
              <ellipse
                cx={CX}
                cy={reflection.cy}
                rx={reflection.rx}
                ry={reflection.ry}
                fill={`url(#${reflectionId})`}
              />
              {config.shape === 'sheet' && (
                <>
                  <path d={SHEET_FOLD} fill={`url(#${foldId})`} />
                  <path d={SHEET_EDGE} fill="none" stroke="#ffffff" strokeOpacity={0.28} strokeWidth={1.2} />
                </>
              )}
              <ellipse cx={CX} cy={BODY_TOP + 12} rx={34} ry={16} fill={`url(#${glossId})`} />
              {/* Arête du verre : un liseré clair, visible seulement à l'intérieur. */}
              <path d={body} fill="none" stroke="#ffffff" strokeOpacity={0.4} strokeWidth={2.4} />
            </g>

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
  shape: 'open' | 'arc' | 'closed'
  closed: boolean
}

function Eye({ x, style, ink, scale, shape, closed }: EyeProps): React.JSX.Element {
  if (shape === 'closed') {
    return (
      <path
        d={`M${x - 5.5} ${EYE_Y} Q${x} ${EYE_Y + 4.5} ${x + 5.5} ${EYE_Y}`}
        fill="none"
        stroke={ink}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    )
  }
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
    // Yeux fins et lumineux, comme des reflets dans le verre.
    case 'oval':
      return <rect x={x - 3} y={EYE_Y - 7} width={6} height={14} rx={3} fill={ink} />
    case 'round':
      return <circle cx={x} cy={EYE_Y} r={4.6} fill={ink} />
    case 'wide':
      return <ellipse cx={x} cy={EYE_Y} rx={6} ry={4} fill={ink} />
    case 'pixel':
      return <rect x={x - 3.5} y={EYE_Y - 5} width={7} height={10} rx={1.5} fill={ink} />
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
