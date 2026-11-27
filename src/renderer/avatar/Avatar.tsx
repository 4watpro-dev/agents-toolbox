import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { createContext, useContext, useId } from 'react'
import {
  DEFAULT_AVATAR,
  glassPalette,
  mixColor,
  type Accessory,
  type AvatarConfig,
  type AvatarState,
  type EyeStyle
} from '../../shared/avatar'
import { EXPRESSIONS } from './expressions'
import { useBlink } from './useBlink'
import './avatar.css'

const CX = 60
const CY = 58
const EYE_Y = 48
const EYE_OFFSET = 11
/** Corps : une sphère. */
const RADIUS = 40
const BODY_TOP = CY - RADIUS

/** Bras en nageoire, dessinés derrière le corps : le gauche levé, le droit le long du flanc. */
const LEFT_ARM = { cx: 24, cy: 40, rx: 11, ry: 16.5, rotate: -42 }
const RIGHT_ARM = { cx: 96, cy: 76, rx: 9, ry: 13.5, rotate: -36 }

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
  const fillId = `${uid}-fill`
  const reflectionId = `${uid}-reflection`
  const glossId = `${uid}-gloss`
  const rimId = `${uid}-rim`
  const armId = `${uid}-arm`
  const groundId = `${uid}-ground`
  const auraId = `${uid}-aura`
  const clipId = `${uid}-body`
  const arm = (shape: typeof LEFT_ARM): React.JSX.Element => (
    <ellipse
      cx={shape.cx}
      cy={shape.cy}
      rx={shape.rx}
      ry={shape.ry}
      transform={`rotate(${shape.rotate} ${shape.cx} ${shape.cy})`}
      fill={`url(#${armId})`}
    />
  )

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
          Sphère brillante, sans filtre de flou (coûteux à chaque image animée) :
          tout le relief vient de dégradés.
        */}
        <defs>
          {/* Teinte profonde en haut à gauche, qui s'éclaircit vers le bas. */}
          <linearGradient id={fillId} x1="0.2" y1="0" x2="0.75" y2="1">
            <stop offset="0" stopColor={palette.core} />
            <stop offset="0.45" stopColor={palette.body} />
            <stop offset="1" stopColor={mixColor(palette.reflection, '#ffffff', 0.15)} />
          </linearGradient>
          {/* Lumière du socle, qui remonte par le bas de la sphère. */}
          <radialGradient id={reflectionId}>
            <stop offset="0.2" stopColor={palette.reflection} stopOpacity="0.95" />
            <stop offset="0.65" stopColor={palette.reflection} stopOpacity="0.5" />
            <stop offset="1" stopColor={palette.reflection} stopOpacity="0" />
          </radialGradient>
          {/* Liseré lumineux du bord, teinté par la lueur. */}
          <radialGradient id={rimId}>
            <stop offset="0.8" stopColor={palette.edge} stopOpacity="0" />
            <stop offset="0.96" stopColor={palette.edge} stopOpacity="0.55" />
            <stop offset="1" stopColor={mixColor(palette.edge, '#ffffff', 0.4)} stopOpacity="0.8" />
          </radialGradient>
          {/* Reflet doux du haut. */}
          <radialGradient id={glossId}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={armId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mixColor(palette.body, palette.edge, 0.25)} />
            <stop offset="1" stopColor={mixColor(palette.body, palette.core, 0.6)} />
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
            <circle cx={CX} cy={CY} r={RADIUS} />
          </clipPath>
        </defs>

        {groundShadow && <ellipse cx={CX} cy={110} rx={34} ry={8} fill={`url(#${groundId})`} />}

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

            {/* Bras derrière le corps ; le gauche salue quand l'agent est content. */}
            <g className={state === 'happy' ? 'avatar-arm avatar-arm-wave' : 'avatar-arm'}>{arm(LEFT_ARM)}</g>
            {arm(RIGHT_ARM)}

            <circle cx={CX} cy={CY} r={RADIUS} fill={`url(#${fillId})`} />
            <g clipPath={`url(#${clipId})`}>
              <ellipse cx={CX + 6} cy={CY + RADIUS - 2} rx={34} ry={20} fill={`url(#${reflectionId})`} />
              <circle cx={CX} cy={CY} r={RADIUS} fill={`url(#${rimId})`} />
              <ellipse
                cx={CX - 14}
                cy={BODY_TOP + 15}
                rx={20}
                ry={11}
                transform={`rotate(-28 ${CX - 14} ${BODY_TOP + 15})`}
                fill={`url(#${glossId})`}
              />
              {/* Point de lumière net, comme sur une bille. */}
              <ellipse
                cx={CX - 22}
                cy={BODY_TOP + 17}
                rx={4.5}
                ry={2.6}
                transform={`rotate(-38 ${CX - 22} ${BODY_TOP + 17})`}
                fill="#ffffff"
                opacity={0.75}
              />
            </g>

            {expression.cheeks && (
              <>
                <ellipse cx={CX - 20} cy={59} rx={5} ry={3} fill="#ff8fa3" opacity={0.6} />
                <ellipse cx={CX + 20} cy={59} rx={5} ry={3} fill="#ff8fa3" opacity={0.6} />
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
      const y = 84
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
