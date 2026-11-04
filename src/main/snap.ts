import type { Corner } from '../shared/ipc'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Coin de la zone de travail le plus proche d'un point. */
export function nearestCorner(point: Point, area: Rect): Corner {
  const vertical = point.y < area.y + area.height / 2 ? 'top' : 'bottom'
  const horizontal = point.x < area.x + area.width / 2 ? 'left' : 'right'
  return `${vertical}-${horizontal}`
}

/** Position d'une fenêtre collée à un coin, à `margin` pixels des bords. */
export function cornerPosition(corner: Corner, area: Rect, size: Size, margin: number): Point {
  const x = corner.endsWith('left') ? area.x + margin : area.x + area.width - size.width - margin
  const y = corner.startsWith('top') ? area.y + margin : area.y + area.height - size.height - margin
  return { x, y }
}

/**
 * Position du panneau : même bord horizontal que l'icône, juste au-dessus ou
 * au-dessous d'elle. Il reste dans la zone de travail sur les petits écrans.
 */
export function panelPosition(
  corner: Corner,
  area: Rect,
  widget: Rect,
  panel: Size,
  gap: number
): Point {
  const x = corner.endsWith('left') ? widget.x : widget.x + widget.width - panel.width
  const y = corner.startsWith('top')
    ? widget.y + widget.height + gap
    : widget.y - panel.height - gap
  return {
    x: clamp(x, area.x, area.x + area.width - panel.width),
    y: clamp(y, area.y, area.y + area.height - panel.height)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)))
}
