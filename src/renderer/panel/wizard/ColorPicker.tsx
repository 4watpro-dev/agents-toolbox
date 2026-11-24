import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { hexToHsv, hsvToHex, parseHex, type Hsv } from './colorMath'

interface ColorPickerProps {
  label: string
  value: string
  onChange(color: string): void
}

const KEY_STEP = 0.02

/**
 * Sélecteur de couleur intégré au panneau. Celui de macOS s'ouvrirait dans une
 * fenêtre système, sous le panneau qui reste toujours au premier plan.
 */
export function ColorPicker({ label, value, onChange }: ColorPickerProps): React.JSX.Element {
  // La teinte est gardée à part : sur un gris ou un noir, la couleur seule l'oublierait.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [hexText, setHexText] = useState(value)
  const area = useRef<HTMLDivElement>(null)
  const hueBar = useRef<HTMLDivElement>(null)

  // Couleur changée ailleurs (une pastille prédéfinie) : le sélecteur la suit.
  useEffect(() => {
    if (hsvToHex(hsv) !== value) setHsv(hexToHsv(value))
    setHexText(value)
  }, [value])

  function apply(next: Hsv): void {
    setHsv(next)
    const hex = hsvToHex(next)
    setHexText(hex)
    onChange(hex)
  }

  /** Suit le pointeur pendant le glissement, même s'il sort de la zone. */
  function drag(element: HTMLDivElement | null, event: PointerEvent<HTMLDivElement>, onMove: (x: number, y: number) => void): void {
    if (!element) return
    element.setPointerCapture(event.pointerId)
    const move = (clientX: number, clientY: number): void => {
      const box = element.getBoundingClientRect()
      onMove(Math.min(Math.max((clientX - box.left) / box.width, 0), 1), Math.min(Math.max((clientY - box.top) / box.height, 0), 1))
    }
    move(event.clientX, event.clientY)
    const onPointerMove = (moveEvent: globalThis.PointerEvent): void => move(moveEvent.clientX, moveEvent.clientY)
    const stop = (): void => {
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerup', stop)
      element.removeEventListener('pointercancel', stop)
    }
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('pointerup', stop)
    element.addEventListener('pointercancel', stop)
  }

  function onAreaKey(event: KeyboardEvent<HTMLDivElement>): void {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    apply({ ...hsv, s: Math.min(Math.max(hsv.s + move[0] * KEY_STEP, 0), 1), v: Math.min(Math.max(hsv.v + move[1] * KEY_STEP, 0), 1) })
  }

  function onHueKey(event: KeyboardEvent<HTMLDivElement>): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 4 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -4 : 0
    if (!step) return
    event.preventDefault()
    apply({ ...hsv, h: (hsv.h + step + 360) % 360 })
  }

  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <div className="color-picker">
      <div
        ref={area}
        className="color-area"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})` }}
        role="slider"
        tabIndex={0}
        aria-label={`${label} : nuance (flèches pour ajuster)`}
        aria-valuetext={hsvToHex(hsv)}
        onPointerDown={(event) => drag(area.current, event, (x, y) => apply({ ...hsv, s: x, v: 1 - y }))}
        onKeyDown={onAreaKey}
      >
        <span className="color-area-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }} />
      </div>
      <div
        ref={hueBar}
        className="color-hue"
        role="slider"
        tabIndex={0}
        aria-label={`${label} : teinte`}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={(event) => drag(hueBar.current, event, (x) => apply({ ...hsv, h: Math.min(x * 360, 359.9) }))}
        onKeyDown={onHueKey}
      >
        <span className="color-hue-thumb" style={{ left: `${(hsv.h / 360) * 100}%`, background: pureHue }} />
      </div>
      <div className="color-hex">
        <span className="color-preview" style={{ background: value }} aria-hidden="true" />
        <input
          className="input input-small"
          aria-label={`${label} : code couleur`}
          spellCheck={false}
          maxLength={7}
          value={hexText}
          onChange={(event) => {
            setHexText(event.target.value)
            const hex = parseHex(event.target.value)
            if (hex) {
              setHsv(hexToHsv(hex))
              onChange(hex)
            }
          }}
          onBlur={() => setHexText(value)}
        />
      </div>
    </div>
  )
}
