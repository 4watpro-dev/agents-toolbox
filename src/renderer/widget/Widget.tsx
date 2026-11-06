import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { DEFAULT_AVATAR, type AvatarConfig } from '../../shared/avatar'
import { Avatar } from '../avatar/Avatar'

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

  useEffect(() => {
    void window.toolbox.widget.getAvatar().then(setAvatar)
    return window.toolbox.widget.onAvatar(setAvatar)
  }, [])

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
      aria-label="Ouvrir Agent Toolbox"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Avatar config={avatar} state={hovered && !dragging ? 'happy' : 'idle'} size={46} groundShadow={false} floating={false} />
    </button>
  )
}
