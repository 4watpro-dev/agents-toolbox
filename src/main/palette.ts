import { BrowserWindow, ipcMain, screen } from 'electron'
import { z } from 'zod'
import { IPC } from '../shared/ipc'
import {
  floatAboveEverything,
  keepNavigationInApp,
  loadPage,
  openConversationInPanel,
  securePreferences,
  setActivationOwner
} from './windows'

/** Largeur fixe ; la hauteur suit le contenu (champ seul, puis réponse). */
const PALETTE_WIDTH = 640
const MIN_HEIGHT = 60
const MAX_HEIGHT = 620
/** Hauteur du haut de la palette, en part de l'écran : là où l'on attend Spotlight. */
const TOP_RATIO = 0.2
/** Après une fermeture par perte de focus, le raccourci ne doit pas rouvrir aussitôt. */
const REOPEN_GUARD_MS = 250

let palette: BrowserWindow
let lastBlurHideAt = 0

const HeightSchema = z.number().finite().min(MIN_HEIGHT).max(5000)
const IdSchema = z.uuid()

function sendState(open: boolean): void {
  palette.webContents.send(IPC.paletteState, open)
}

/** Centre la palette sur l'écran où se trouve la souris. */
function place(height: number): void {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  palette.setBounds({
    x: Math.round(workArea.x + (workArea.width - PALETTE_WIDTH) / 2),
    y: Math.round(workArea.y + workArea.height * TOP_RATIO),
    width: PALETTE_WIDTH,
    height: Math.round(height)
  })
}

export function isPaletteOpen(): boolean {
  return palette.isVisible()
}

export function openPalette(): void {
  place(palette.getBounds().height)
  palette.show()
  palette.focus()
  sendState(true)
}

export function hidePalette(): void {
  if (!palette.isVisible()) return
  palette.hide()
  sendState(false)
}

export function togglePalette(): void {
  if (palette.isVisible()) hidePalette()
  else if (Date.now() - lastBlurHideAt >= REOPEN_GUARD_MS) openPalette()
}

function createPaletteWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: PALETTE_WIDTH,
    height: MIN_HEIGHT,
    show: false,
    frame: false,
    // Même verre natif que le panneau.
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    type: 'panel',
    webPreferences: securePreferences
  })
  floatAboveEverything(window)
  keepNavigationInApp(window)
  // Comme Spotlight : un clic ailleurs referme la palette.
  window.on('blur', () => {
    if (!window.isVisible()) return
    lastBlurHideAt = Date.now()
    hidePalette()
  })
  loadPage(window, 'palette')
  return window
}

export function createPalette(): void {
  palette = createPaletteWindow()
  // Montrer la palette fait passer l'app au premier plan : ce n'est pas une demande d'ouvrir le panneau.
  setActivationOwner(() => palette.isVisible())

  ipcMain.on(IPC.paletteResize, (_event, height: unknown) => {
    const parsed = HeightSchema.safeParse(height)
    if (!parsed.success) return
    const { workArea } = screen.getDisplayMatching(palette.getBounds())
    const room = workArea.y + workArea.height - palette.getBounds().y - 16
    const bounds = palette.getBounds()
    palette.setBounds({ ...bounds, height: Math.round(Math.min(parsed.data, MAX_HEIGHT, room)) })
  })
  ipcMain.on(IPC.paletteClose, () => hidePalette())
  ipcMain.on(IPC.paletteContinue, (_event, agentId: unknown, conversationId: unknown) => {
    const agent = IdSchema.parse(agentId)
    const conversation = IdSchema.parse(conversationId)
    hidePalette()
    openConversationInPanel(agent, conversation)
  })
}
