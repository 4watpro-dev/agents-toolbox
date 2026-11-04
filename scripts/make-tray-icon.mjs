// Génère l'icône « template » de la barre de menus macOS (noir + transparence).
// Usage : node scripts/make-tray-icon.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OVERSAMPLING = 4

/** Vrai si le point (en unités d'une grille 16×16) est dans le robot. */
function inRobot(x, y) {
  const antennaBall = Math.hypot(x - 8, y - 2) <= 1.4
  const antennaStem = Math.abs(x - 8) <= 0.5 && y >= 2 && y <= 5
  // Tête en capsule : un rectangle aux extrémités arrondies.
  const nearestX = Math.max(5.5, Math.min(x, 10.5))
  const head = Math.hypot(x - nearestX, y - 9.5) <= 4.5
  const eye = (cx) => ((x - cx) / 1.1) ** 2 + ((y - 9.5) / 1.6) ** 2 <= 1
  return antennaBall || antennaStem || (head && !eye(6) && !eye(10))
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
          if (inRobot(x, y)) hits++
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
