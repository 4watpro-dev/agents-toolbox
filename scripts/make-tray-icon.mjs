// Génère l'icône « template » de la barre de menus macOS (noir + transparence).
// Usage : node scripts/make-tray-icon.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OVERSAMPLING = 4

/** Point dans une ellipse tournée de `angle` degrés. */
function inEllipse(x, y, cx, cy, rx, ry, angle) {
  const a = (-angle * Math.PI) / 180
  const dx = x - cx
  const dy = y - cy
  const u = dx * Math.cos(a) - dy * Math.sin(a)
  const v = dx * Math.sin(a) + dy * Math.cos(a)
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1
}

// Grille 120 du composant Avatar ramenée à 16 : la sphère et ses deux bras tiennent dans le carré.
const K = 0.15
const map = (value, center, origin) => (value - center) * K + origin

/** Vrai si le point (en unités d'une grille 16×16) est dans la sphère, yeux évidés. */
function inSphere(x, y) {
  const ax = (x - 8.4) / K + 60
  const ay = (y - 8.6) / K + 58
  const body = Math.hypot(ax - 60, ay - 58) <= 40
  const arms = inEllipse(ax, ay, 24, 40, 11, 16.5, -42) || inEllipse(ax, ay, 96, 76, 9, 13.5, -36)
  // Yeux agrandis : à 16 px, ceux de l'app feraient moins d'un pixel.
  const eye = (cx) => ((x - map(cx, 60, 8.4)) / 0.8) ** 2 + ((y - map(48, 58, 8.6)) / 1.35) ** 2 <= 1
  return (body || arms) && !eye(48) && !eye(72)
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

function png(size) {
  const rows = []
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4) // Filtre 0, puis RGBA : le RGB reste à 0.
    for (let px = 0; px < size; px++) {
      let hits = 0
      for (let sy = 0; sy < OVERSAMPLING; sy++) {
        for (let sx = 0; sx < OVERSAMPLING; sx++) {
          const x = ((px + (sx + 0.5) / OVERSAMPLING) / size) * 16
          const y = ((py + (sy + 0.5) / OVERSAMPLING) / size) * 16
          if (inSphere(x, y)) hits++
        }
      }
      row[1 + px * 4 + 3] = Math.round((hits / OVERSAMPLING ** 2) * 255)
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // 8 bits par canal
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync('resources', { recursive: true })
writeFileSync('resources/trayTemplate.png', png(16))
writeFileSync('resources/trayTemplate@2x.png', png(32))
