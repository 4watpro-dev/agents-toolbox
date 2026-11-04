import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { createContext, useContext, useId } from 'react'
import {
  DEFAULT_AVATAR,
  faceColor,
  type Accessory,
  type AvatarConfig,
  type AvatarState,
  type EyeStyle,
  type HeadShape
} from '../../shared/avatar'
import { EXPRESSIONS } from './expressions'
import { useBlink } from './useBlink'
import './avatar.css'

const CX = 60
const CY = 66
const EYE_OFFSET = 16

const HEADS: Record<HeadShape, { width: number; height: number; radius: number }> = {
  capsule: { width: 88, height: 66, radius: 33 },
  round: { width: 76, height: 76, radius: 38 },
  square: { width: 78, height: 70, radius: 17 }
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
  const head = HEADS[config.headShape]
  const ink = faceColor(config.headColor)
  const top = CY - head.height / 2
  const shadingId = `${uid}-shading`
  const clipId = `${uid}-head`

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
          {/* Léger modelé qui garde le volume, quelle que soit la couleur de la tête. */}
          <linearGradient id={shadingId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="1" stopColor="#101828" stopOpacity="0.06" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x={CX - head.width / 2} y={top} width={head.width} height={head.height} rx={head.radius} />
          </clipPath>
        </defs>

        {groundShadow && <ellipse className="avatar-ground" cx={CX} cy={113} rx={30} ry={4} />}

        <g className={floating ? 'avatar-float' : undefined}>
          <motion.g
            animate={{ y: expression.head.y, rotate: expression.head.rotate }}
            transition={SPRING}
            style={{ originX: `${CX}px`, originY: `${CY}px`, transformBox: 'view-box' }}
          >
            <Antenna color={config.antennaColor} top={top} {...expression.antenna} />

            <rect x={CX - head.width / 2 - 6} y={CY - 10} width={9} height={20} rx={4.5} fill="#b9bfc9" />
            <rect x={CX + head.width / 2 - 3} y={CY - 10} width={9} height={20} rx={4.5} fill="#b9bfc9" />

            <rect
              x={CX - head.width / 2}
              y={top}
              width={head.width}
              height={head.height}
              rx={head.radius}
              fill={config.headColor}
            />
            <rect
              x={CX - head.width / 2}
              y={top}
              width={head.width}
              height={head.height}
              rx={head.radius}
              fill={`url(#${shadingId})`}
            />

            {expression.cheeks && (
              <>
                <ellipse cx={CX - 28} cy={CY + 11} rx={6} ry={3.5} fill="#ff8fa3" opacity={0.55} />
                <ellipse cx={CX + 28} cy={CY + 11} rx={6} ry={3.5} fill="#ff8fa3" opacity={0.55} />
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

            <AnimatePresence>
              {expression.brows && (
                <motion.g
                  key="brows"
                  fill="none"
                  stroke={ink}
                  strokeWidth={3}
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
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>

            <AccessoryLayer accessory={config.accessory} ink={ink} top={top} width={head.width} height={head.height} clipId={clipId} />
          </motion.g>
        </g>
      </svg>
    </MotionConfig>
  )
}

interface AntennaProps {
  color: string
  top: number
  rotate: number
  glow: 'off' | 'on' | 'pulse'
  dimmed?: boolean
}

function Antenna({ color, top, rotate, glow, dimmed }: AntennaProps): React.JSX.Element {
  const ballY = top - 15
  return (
    <motion.g
      animate={{ rotate }}
      transition={SPRING}
      style={{ originX: `${CX}px`, originY: `${top}px`, transformBox: 'view-box' }}
    >
      <line x1={CX} y1={top + 2} x2={CX} y2={ballY} stroke="#b9bfc9" strokeWidth={3} strokeLinecap="round" />
      {glow !== 'off' && (
        <circle className={`avatar-halo avatar-halo-${glow}`} cx={CX} cy={ballY} r={11} fill={color} />
      )}
      <circle
        className={glow === 'pulse' ? 'avatar-ball-pulse' : undefined}
        cx={CX}
        cy={ballY}
        r={6}
        fill={color}
        opacity={dimmed ? 0.45 : 1}
      />
      <circle cx={CX - 1.8} cy={ballY - 1.8} r={1.5} fill="#ffffff" opacity={0.8} />
    </motion.g>
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
        d={`M${x - 8} ${CY + 2} Q${x} ${CY - 10} ${x + 8} ${CY + 2}`}
        fill="none"
        stroke={ink}
        strokeWidth={4}
        strokeLinecap="round"
      />
    )
  }
  return (
    <motion.g
      initial={false}
      animate={{ scaleX: scale, scaleY: closed ? 0.08 : scale }}
      transition={closed ? { duration: 0.05 } : { duration: 0.09 }}
      style={{ originX: `${x}px`, originY: `${CY}px`, transformBox: 'view-box' }}
    >
      <EyeShape x={x} style={style} ink={ink} />
      {!closed && <circle cx={x + 2.6} cy={CY - 4} r={2.5} fill={ink === '#20242c' ? '#ffffff' : '#20242c'} />}
    </motion.g>
  )
}

function EyeShape({ x, style, ink }: { x: number; style: EyeStyle; ink: string }): React.JSX.Element {
  switch (style) {
    case 'oval':
      return <ellipse cx={x} cy={CY} rx={8} ry={11} fill={ink} />
    case 'round':
      return <circle cx={x} cy={CY} r={9} fill={ink} />
    case 'wide':
      return <ellipse cx={x} cy={CY} rx={10.5} ry={7.5} fill={ink} />
    case 'pixel':
      return <rect x={x - 7} y={CY - 9} width={14} height={18} rx={3.5} fill={ink} />
  }
}

interface AccessoryLayerProps {
  accessory: Accessory
  ink: string
  top: number
  width: number
  height: number
  clipId: string
}

function AccessoryLayer({ accessory, ink, top, width, height, clipId }: AccessoryLayerProps): React.JSX.Element | null {
  const left = CX - width / 2
  const right = CX + width / 2
  switch (accessory) {
    case 'none':
      return null
    case 'glasses':
      return (
        <g fill="none" stroke={ink} strokeWidth={2.4}>
          <circle cx={CX - EYE_OFFSET} cy={CY} r={13.5} />
          <circle cx={CX + EYE_OFFSET} cy={CY} r={13.5} />
          <path d={`M${CX - 2.5} ${CY - 1} Q${CX} ${CY - 3} ${CX + 2.5} ${CY - 1}`} />
        </g>
      )
    case 'headphones':
      return (
        <g>
          <path
            d={`M${left - 3} ${CY - 6} C${left - 3} ${top - 18} ${right + 3} ${top - 18} ${right + 3} ${CY - 6}`}
            fill="none"
            stroke="#3d4452"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <rect x={left - 9} y={CY - 13} width={12} height={26} rx={6} fill="#3d4452" />
          <rect x={right - 3} y={CY - 13} width={12} height={26} rx={6} fill="#3d4452" />
        </g>
      )
    case 'bowtie': {
      const y = top + height + 7
      return (
        <g fill="#d64550">
          <path d={`M${CX} ${y} L${CX - 13} ${y - 7} Q${CX - 15} ${y} ${CX - 13} ${y + 7} Z`} />
          <path d={`M${CX} ${y} L${CX + 13} ${y - 7} Q${CX + 15} ${y} ${CX + 13} ${y + 7} Z`} />
          <rect x={CX - 3} y={y - 3.5} width={6} height={7} rx={2} fill="#a8323d" />
        </g>
      )
    }
    case 'beanie': {
      const depth = height * 0.3
      return (
        <g clipPath={`url(#${clipId})`}>
          <rect x={left} y={top} width={width} height={depth} fill="#e4572e" />
          <rect x={left} y={top + depth - 7} width={width} height={7} fill="#b83f1d" />
        </g>
      )
    }
  }
}
