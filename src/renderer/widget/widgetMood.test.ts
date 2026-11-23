import { describe, expect, it } from 'vitest'
import { widgetMood, type WidgetFlags } from './widgetMood'

const calm: WidgetFlags = { dragging: false, hovered: false, waking: null, celebrating: false, working: false, badge: false, away: false }

describe('widgetMood', () => {
  it('se repose sans rien à signaler', () => {
    expect(widgetMood(calm)).toBe('idle')
  })

  it("s'assoupit en ton absence, même avec un résultat qui attend", () => {
    expect(widgetMood({ ...calm, away: true })).toBe('sleepy')
    expect(widgetMood({ ...calm, away: true, badge: true })).toBe('sleepy')
  })

  it('se réveille avec un sursaut puis un sourire', () => {
    expect(widgetMood({ ...calm, waking: 'surprised' })).toBe('surprised')
    expect(widgetMood({ ...calm, waking: 'happy', badge: true })).toBe('happy')
  })

  it('se concentre pendant une tâche, et se réjouit quand elle finit', () => {
    expect(widgetMood({ ...calm, working: true })).toBe('thinking')
    expect(widgetMood({ ...calm, working: true, celebrating: true })).toBe('happy')
    expect(widgetMood({ ...calm, badge: true })).toBe('happy')
  })

  it('reste content au survol, et neutre pendant un déplacement', () => {
    expect(widgetMood({ ...calm, away: true, hovered: true })).toBe('happy')
    expect(widgetMood({ ...calm, hovered: true, dragging: true })).toBe('idle')
  })
})
