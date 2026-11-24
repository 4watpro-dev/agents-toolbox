/** Teinte (0–360), saturation et valeur (0–1) : le modèle du sélecteur de couleur. */
export interface Hsv {
  h: number
  s: number
  v: number
}

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1)

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const saturation = clamp01(s)
  const value = clamp01(v)
  const f = (n: number): number => {
    const k = (n + h / 60) % 6
    return value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`
}

/** Code saisi à la main : « #a1b2c3 », « a1b2c3 » ou la forme courte « #abc ». `null` s'il est illisible. */
export function parseHex(text: string): string | null {
  const raw = text.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`
  if (/^[0-9a-f]{3}$/.test(raw)) return `#${[...raw].map((c) => c + c).join('')}`
  return null
}
