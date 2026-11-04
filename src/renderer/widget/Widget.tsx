import { useRef, useState, type PointerEvent } from 'react'

const DRAG_THRESHOLD_PX = 4

interface Press {
  x: number
  y: number
  dragging: boolean
}

export function Widget(): React.JSX.Element {
  const press = useRef<Press | null>(null)
  const [dragging, setDragging] = useState(false)

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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Icône provisoire : l'avatar animé arrive au jalon 2. */}
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <line x1="28" y1="15" x2="28" y2="9" stroke="#b9bfc9" strokeWidth="2" strokeLinecap="round" />
        <circle cx="28" cy="8" r="3" fill="#3b8cff" />
        <rect x="11" y="15" width="34" height="28" rx="14" fill="#fff" stroke="#e4e7ec" />
        <ellipse cx="22" cy="29" rx="3" ry="4.5" fill="#20242c" />
        <ellipse cx="34" cy="29" rx="3" ry="4.5" fill="#20242c" />
      </svg>
    </button>
  )
}
