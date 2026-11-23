import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { DEFAULT_AVATAR, type AvatarConfig } from '../../shared/avatar'
import { Avatar } from '../avatar/Avatar'
import { CELEBRATE_MS, WAKE_SURPRISE_MS, WAKE_TOTAL_MS, widgetMood } from './widgetMood'

const DRAG_THRESHOLD_PX = 4

interface Press {
  x: number
  y: number
  dragging: boolean
}

export function Widget(): React.JSX.Element {
  const press = useRef<Press | null>(null)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR)
  const [badge, setBadge] = useState(false)
  const [away, setAway] = useState(false)
  const [working, setWorking] = useState(false)
  const [waking, setWaking] = useState<'surprised' | 'happy' | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  /** Joue une petite scène limitée dans le temps : rien ne tourne en continu. */
  function later(delay: number, action: () => void): void {
    timers.current.push(setTimeout(action, delay))
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  useEffect(() => {
    void window.toolbox.widget.getAvatar().then(setAvatar)
    return window.toolbox.widget.onAvatar(setAvatar)
  }, [])

  useEffect(
    () =>
      window.toolbox.widget.onBadge((visible) => {
        setBadge((before) => {
          // Un nouveau résultat : le fantôme fête la fin de la tâche.
          if (visible && !before) {
            setCelebrating(true)
            later(CELEBRATE_MS, () => setCelebrating(false))
          }
          return visible
        })
      }),
    []
  )

  useEffect(
    () =>
      window.toolbox.widget.onSignal((signal) => {
        if (signal.type === 'working') setWorking(signal.on)
        else if (signal.type === 'away') setAway(true)
        else {
          setAway(false)
          setWaking('surprised')
          later(WAKE_SURPRISE_MS, () => setWaking('happy'))
          later(WAKE_TOTAL_MS, () => setWaking(null))
        }
      }),
    []
  )

  const mood = widgetMood({ dragging, hovered, waking, celebrating, working, badge, away })
  const scene = celebrating ? 'is-celebrating' : waking === 'surprised' ? 'is-waking' : away && !hovered ? 'is-asleep' : ''

  function onPointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return
    // La capture garde les événements même si le curseur sort de la petite fenêtre.
    event.currentTarget.setPointerCapture(event.pointerId)
    press.current = { x: event.screenX, y: event.screenY, dragging: false }
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>): void {
    const current = press.current
    if (!current || current.dragging) return
    const distance = Math.hypot(event.screenX - current.x, event.screenY - current.y)
    if (distance < DRAG_THRESHOLD_PX) return
    current.dragging = true
    setDragging(true)
    window.toolbox.widget.dragStart()
  }

  function onPointerUp(): void {
    const current = press.current
    press.current = null
    if (!current) return
    if (current.dragging) {
      setDragging(false)
      window.toolbox.widget.dragEnd()
    } else {
      window.toolbox.widget.click(Date.now())
    }
  }

  return (
    <button
      type="button"
      className={dragging ? 'widget dragging' : 'widget'}
      aria-label={badge ? 'Ouvrir Agent Toolbox : un résultat de tâche t’attend' : 'Ouvrir Agent Toolbox'}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className={`widget-ghost ${scene}`}>
        <Avatar config={avatar} state={mood} size={46} groundShadow={false} floating={false} />
      </span>
      {scene === 'is-asleep' && (
        <span className="widget-zzz" aria-hidden="true">
          z
        </span>
      )}
      {badge && <span className={celebrating ? 'widget-badge is-new' : 'widget-badge'} aria-hidden="true" />}
    </button>
  )
}
