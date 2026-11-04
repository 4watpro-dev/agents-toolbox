import { describe, expect, it } from 'vitest'
import { cornerPosition, nearestCorner, panelPosition } from './snap'

const screen = { x: 0, y: 25, width: 1440, height: 875 }
// Écran secondaire placé à gauche : ses coordonnées sont négatives.
const leftScreen = { x: -1920, y: 0, width: 1920, height: 1080 }

describe('nearestCorner', () => {
  it.each([
    [{ x: 10, y: 40 }, 'top-left'],
    [{ x: 1400, y: 40 }, 'top-right'],
    [{ x: 10, y: 880 }, 'bottom-left'],
    [{ x: 1400, y: 880 }, 'bottom-right']
  ] as const)('%o donne %s', (point, corner) => {
    expect(nearestCorner(point, screen)).toBe(corner)
  })

  it('gère un écran aux coordonnées négatives', () => {
    expect(nearestCorner({ x: -1900, y: 1000 }, leftScreen)).toBe('bottom-left')
    expect(nearestCorner({ x: -100, y: 10 }, leftScreen)).toBe('top-right')
  })
})

describe('cornerPosition', () => {
  const size = { width: 72, height: 72 }

  it('place la fenêtre à la marge du coin bas-droit', () => {
    expect(cornerPosition('bottom-right', screen, size, 16)).toEqual({ x: 1352, y: 812 })
  })

  it('tient compte de la barre de menus en haut', () => {
    expect(cornerPosition('top-left', screen, size, 16)).toEqual({ x: 16, y: 41 })
  })
})

describe('panelPosition', () => {
  const panel = { width: 412, height: 592 }

  it('ouvre au-dessus de l\'icône quand elle est en bas', () => {
    const widget = { x: 1352, y: 812, width: 72, height: 72 }
    expect(panelPosition('bottom-right', screen, widget, panel, 0)).toEqual({ x: 1012, y: 220 })
  })

  it('ouvre au-dessous de l\'icône quand elle est en haut', () => {
    const widget = { x: 16, y: 41, width: 72, height: 72 }
    expect(panelPosition('top-left', screen, widget, panel, 0)).toEqual({ x: 16, y: 113 })
  })

  it('reste dans la zone de travail sur un écran trop petit', () => {
    const small = { x: 0, y: 25, width: 1024, height: 500 }
    const widget = { x: 936, y: 437, width: 72, height: 72 }
    expect(panelPosition('bottom-right', small, widget, panel, 0).y).toBe(25)
  })
})
