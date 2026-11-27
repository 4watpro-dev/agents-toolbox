// Génère l'icône de l'app (Dock, Cmd+Tab, Applications, Windows) et l'icône couleur de la
// zone de notification Windows : la sphère verte des agents, en style plat.
// Usage : npx electron scripts/make-app-icon.mjs  → build/icon.png (1024 px), resources/trayWindows.png (32 px)
import { app, BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'

app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.dock?.hide()
// Une image après l'autre : fermer la première fenêtre ne doit pas quitter le script.
app.on('window-all-closed', () => undefined)

// Style plat, comme l'ancienne icône : un dégradé vertical, un reflet doux, des yeux sombres.
const C = {
  bodyTop: '#8af59a',
  bodyBottom: '#3cc457',
  armTop: '#6ee883',
  armBottom: '#2fae48',
  eye: '#10131a'
}

/** La sphère des agents, dans la grille 120 × 120 du composant Avatar, sans le relief du verre. */
const sphere = () => `
  <defs>
    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bodyTop}"/><stop offset="1" stop-color="${C.bodyBottom}"/></linearGradient>
    <linearGradient id="arm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.armTop}"/><stop offset="1" stop-color="${C.armBottom}"/></linearGradient>
    <radialGradient id="shine"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <clipPath id="body"><circle cx="60" cy="58" r="40"/></clipPath>
  </defs>
  <ellipse cx="24" cy="40" rx="11" ry="16.5" transform="rotate(-42 24 40)" fill="url(#arm)"/>
  <ellipse cx="96" cy="76" rx="9" ry="13.5" transform="rotate(-36 96 76)" fill="url(#arm)"/>
  <circle cx="60" cy="58" r="40" fill="url(#fill)"/>
  <circle cx="44" cy="36" r="20" fill="url(#shine)" clip-path="url(#body)"/>
  <ellipse cx="49" cy="50" rx="4.6" ry="7" fill="${C.eye}"/>
  <ellipse cx="71" cy="50" rx="4.6" ry="7" fill="${C.eye}"/>`

// Grille macOS : carré arrondi de 824 px centré, rayon d'environ 185 px.
const APP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262b36"/><stop offset="1" stop-color="#0d0f13"/></linearGradient>
    <radialGradient id="halo"><stop offset="0" stop-color="#c8f031" stop-opacity="0.2"/><stop offset="1" stop-color="#c8f031" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#tile)"/>
  <circle cx="512" cy="500" r="360" fill="url(#halo)"/>
  <g transform="translate(140 152) scale(6.2)">${sphere()}</g>
</svg>`

// Zone de notification Windows : la sphère seule, bras compris, sur fond transparent.
const TRAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="8 14 104 92">${sphere()}</svg>`

async function render(svg, size, path) {
  const window = new BrowserWindow({ width: size, height: size, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } })
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  writeFileSync(path, image.toPNG())
  window.destroy()
  console.log(`${path} écrit`)
}

app.whenReady().then(async () => {
  mkdirSync('build', { recursive: true })
  mkdirSync('resources', { recursive: true })
  await render(APP_ICON, 1024, 'build/icon.png')
  await render(TRAY_ICON, 32, 'resources/trayWindows.png')
  app.quit()
})
