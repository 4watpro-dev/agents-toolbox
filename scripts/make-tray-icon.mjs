// Génère l'icône « template » de la barre de menus macOS (noir + transparence).
// Usage : node scripts/make-tray-icon.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OVERSAMPLING = 4

/** Vrai si le point (en unités d'une grille 16×16) est dans le fantôme. */
function inGhost(x, y) {
  const round = Math.hypot(x - 8, y - 7) <= 6
  // Pointe de la goutte : un cône tangent au cercle, qui finit en y = 15.
  const tip = y >= 11.5 && y <= 15 && Math.abs(x - 8) <= (15 - y) * 1.134
  const eye = (cx) => ((x - cx) / 1) ** 2 + ((y - 6) / 1.5) ** 2 <= 1
  return (round || tip) && !eye(6.2) && !eye(9.8)
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
          if (inGhost(x, y)) hits++
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
