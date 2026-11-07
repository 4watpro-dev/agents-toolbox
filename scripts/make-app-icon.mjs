// Génère l'icône de l'app (Dock, Cmd+Tab, Applications) : un fantôme vert sur fond sombre.
// Usage : node scripts/make-app-icon.mjs  → build/icon.png (1024 × 1024)
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SIZE = 1024
const OVERSAMPLING = 3
// Grille macOS : carré arrondi de 824 px centré, rayon d'environ 185 px.
const TILE = { x: 100, y: 100, size: 824, radius: 185 }
// Le fantôme est décrit sur une grille 16 × 16 (comme l'icône de la barre de menus).
const GHOST_SCALE = 38
const GHOST_OFFSET = { x: SIZE / 2 - 8 * GHOST_SCALE, y: SIZE / 2 - 8.3 * GHOST_SCALE }

const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t)
const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))

const TILE_TOP = hex('#262b36')
const TILE_BOTTOM = hex('#0d0f13')
const BODY_TOP = hex('#8af59a')
const BODY_BOTTOM = hex('#3cc457')
const EYE = hex('#10131a')
const ACCENT = hex('#c8f031')

function inTile(x, y) {
  const { x: left, y: top, size, radius } = TILE
  const cx = Math.min(Math.max(x, left + radius), left + size - radius)
  const cy = Math.min(Math.max(y, top + radius), top + size - radius)
  return Math.hypot(x - cx, y - cy) <= radius
}

function inGhostBody(gx, gy) {
  const round = Math.hypot(gx - 8, gy - 7) <= 6
  const tip = gy >= 11.5 && gy <= 15 && Math.abs(gx - 8) <= (15 - gy) * 1.134
  return round || tip
}

const inEye = (gx, gy, cx) => ((gx - cx) / 0.9) ** 2 + ((gy - 6.6) / 1.35) ** 2 <= 1

/** Couleur RGBA (0–255) d'un point de l'icône. */
function sample(x, y) {
  if (!inTile(x, y)) return [0, 0, 0, 0]
  const t = (y - TILE.y) / TILE.size
  let color = mix(TILE_TOP, TILE_BOTTOM, t)
  const gx = (x - GHOST_OFFSET.x) / GHOST_SCALE
  const gy = (y - GHOST_OFFSET.y) / GHOST_SCALE
  // Halo vert citron discret autour du fantôme.
  const glow = Math.max(0, 1 - Math.hypot(gx - 8, gy - 8) / 9.5)
  color = mix(color, ACCENT, glow * glow * 0.22)
  if (inGhostBody(gx, gy)) {
    color = mix(BODY_TOP, BODY_BOTTOM, Math.min(Math.max((gy - 1) / 14, 0), 1))
    // Reflet en haut à gauche.
    const shine = Math.max(0, 1 - Math.hypot(gx - 5.6, gy - 3.6) / 2.6)
    color = mix(color, [255, 255, 255], shine * 0.35)
    if (inEye(gx, gy, 6.1) || inEye(gx, gy, 9.9)) color = EYE
  }
  return [...color, 255]
}

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

const rows = []
const samples = OVERSAMPLING ** 2
for (let py = 0; py < SIZE; py++) {
  const row = Buffer.alloc(1 + SIZE * 4)
  for (let px = 0; px < SIZE; px++) {
    // Moyenne prémultipliée : les bords restent nets, sans liseré sombre.
    const sum = [0, 0, 0, 0]
    for (let sy = 0; sy < OVERSAMPLING; sy++) {
      for (let sx = 0; sx < OVERSAMPLING; sx++) {
        const [r, g, b, a] = sample(px + (sx + 0.5) / OVERSAMPLING, py + (sy + 0.5) / OVERSAMPLING)
        sum[0] += r * a
        sum[1] += g * a
        sum[2] += b * a
        sum[3] += a
      }
    }
    const offset = 1 + px * 4
    if (sum[3] > 0) for (let i = 0; i < 3; i++) row[offset + i] = Math.round(sum[i] / sum[3])
    row[offset + 3] = Math.round(sum[3] / samples)
  }
  rows.push(row)
}

const header = Buffer.alloc(13)
header.writeUInt32BE(SIZE, 0)
header.writeUInt32BE(SIZE, 4)
header[8] = 8
header[9] = 6
mkdirSync('build', { recursive: true })
writeFileSync(
  'build/icon.png',
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ])
)
console.log('build/icon.png écrit')
