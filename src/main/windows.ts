import { join } from 'node:path'
import { BrowserWindow, ipcMain, screen, shell, type Display } from 'electron'
import { z } from 'zod'
import { IPC, type Corner, type PanelState } from '../shared/ipc'
import { cornerPosition, nearestCorner, panelPosition } from './snap'
import type { AvatarConfig } from '../shared/avatar'
import { getSettings, updateSettings } from './store/settings'

/** Horodatage (Date.now) du geste à l'origine de l'ouverture du panneau. */
const TimestampSchema = z.number().finite().nonnegative()

const WIDGET_SIZE = { width: 72, height: 72 }
// 380×560 de contenu, plus 16 px de marge transparente pour l'ombre.
const PANEL_SIZE = { width: 412, height: 592 }
const EDGE_MARGIN = 8
const DRAG_INTERVAL_MS = 16
const SNAP_DURATION_MS = 160
const PANEL_CLOSE_MS = 120
// Un clic sur l'icône juste après une fermeture par perte de focus ne doit pas rouvrir.
const REOPEN_GUARD_MS = 250

let widget: BrowserWindow
let panel: BrowserWindow
let dragTimer: NodeJS.Timeout | null = null
let snapTimer: NodeJS.Timeout | null = null
let closeTimer: NodeJS.Timeout | null = null
let panelOpen = false
let lastBlurCloseAt = 0

const securePreferences = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  // Le panneau reste caché entre deux ouvertures : il doit rester prêt à s'afficher.
  backgroundThrottling: false
}

function loadPage(window: BrowserWindow, page: 'widget' | 'panel' | 'demo'): void {
  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (devServer) {
    void window.loadURL(`${devServer}/${page}.html`)
  } else {
    void window.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

function openInBrowser(url: string): void {
  const { protocol } = new URL(url)
  if (protocol === 'https:' || protocol === 'http:') void shell.openExternal(url)
}

/** Un lien dans une réponse s'ouvre dans le navigateur : l'app ne quitte jamais ses pages. */
function keepNavigationInApp(window: BrowserWindow): void {
  const { webContents } = window
  webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url)
    return { action: 'deny' }
  })
  webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    openInBrowser(url)
  })
}

function floatAboveEverything(window: BrowserWindow): void {
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true
  })
}

function currentDisplay(): Display {
  const { displayId } = getSettings().widget
  const saved = screen.getAllDisplays().find((display) => display.id === displayId)
  // L'écran mémorisé peut avoir été débranché.
  return saved ?? screen.getPrimaryDisplay()
}

function moveWidgetTo(corner: Corner, display: Display, animated: boolean): void {
  stopSnapAnimation()
  const target = cornerPosition(corner, display.workArea, WIDGET_SIZE, EDGE_MARGIN)
  if (!animated) {
    widget.setBounds({ ...target, ...WIDGET_SIZE })
    return
  }
  const [startX, startY] = widget.getPosition()
  const startedAt = Date.now()
  snapTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - startedAt) / SNAP_DURATION_MS)
    const eased = 1 - (1 - progress) ** 3
    widget.setBounds({
      x: Math.round(startX + (target.x - startX) * eased),
      y: Math.round(startY + (target.y - startY) * eased),
      ...WIDGET_SIZE
    })
    if (progress === 1) stopSnapAnimation()
  }, DRAG_INTERVAL_MS)
}

function stopSnapAnimation(): void {
  if (snapTimer) clearInterval(snapTimer)
  snapTimer = null
}

function sendPanelState(open: boolean, requestedAt: number): void {
  const state: PanelState = { open, corner: getSettings().widget.corner, requestedAt }
  panel.webContents.send(IPC.panelState, state)
}

export function openPanel(requestedAt = Date.now()): void {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
  const { corner } = getSettings().widget
  const position = panelPosition(corner, currentDisplay().workArea, widget.getBounds(), PANEL_SIZE, 0)
  panel.setBounds({ ...position, ...PANEL_SIZE })
  panelOpen = true
  sendPanelState(true, requestedAt)
  panel.show()
  panel.focus()
}

export function openSettingsInPanel(): void {
  panel.webContents.send(IPC.panelNavigate, 'settings')
  openPanel()
}

export function closePanel(): void {
  if (!panelOpen) return
  panelOpen = false
  sendPanelState(false, 0)
  // Laisse l'animation de fermeture se jouer avant de cacher la fenêtre.
  closeTimer = setTimeout(() => panel.hide(), PANEL_CLOSE_MS)
}

export function togglePanel(requestedAt = Date.now()): void {
  if (panelOpen) closePanel()
  else openPanel(requestedAt)
}

function startDrag(): void {
  stopSnapAnimation()
  closePanel()
  const cursor = screen.getCursorScreenPoint()
  const [x, y] = widget.getPosition()
  const offset = { x: cursor.x - x, y: cursor.y - y }
  if (dragTimer) clearInterval(dragTimer)
  // On suit le curseur depuis le main : aucun déplacement n'est perdu si la
  // souris va plus vite que la fenêtre.
  dragTimer = setInterval(() => {
    const point = screen.getCursorScreenPoint()
    widget.setBounds({ x: point.x - offset.x, y: point.y - offset.y, ...WIDGET_SIZE })
  }, DRAG_INTERVAL_MS)
}

function endDrag(): void {
  if (dragTimer) clearInterval(dragTimer)
  dragTimer = null
  const bounds = widget.getBounds()
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const display = screen.getDisplayNearestPoint(center)
  const corner = nearestCorner(center, display.workArea)
  updateSettings({ widget: { displayId: display.id, corner } })
  moveWidgetTo(corner, display, true)
}

function registerIpc(): void {
  ipcMain.on(IPC.widgetClick, (_event, at: unknown) => {
    const parsed = TimestampSchema.safeParse(at)
    if (!parsed.success) return
    if (Date.now() - lastBlurCloseAt < REOPEN_GUARD_MS) return
    togglePanel(parsed.data)
  })
  ipcMain.on(IPC.widgetDragStart, startDrag)
  ipcMain.on(IPC.widgetDragEnd, endDrag)
  ipcMain.on(IPC.panelClose, closePanel)
  ipcMain.on(IPC.panelPainted, (_event, requestedAt: unknown) => {
    const parsed = TimestampSchema.safeParse(requestedAt)
    if (parsed.success) console.log(`[panneau] affiché en ${Date.now() - parsed.data} ms`)
  })
}

function createWidget(): BrowserWindow {
  const window = new BrowserWindow({
    ...WIDGET_SIZE,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // L'icône ne prend pas le focus : le premier clic agit même si une autre
    // app est au premier plan, et il ne ferme pas le panneau par perte de focus.
    focusable: false,
    acceptFirstMouse: true,
    webPreferences: securePreferences
  })
  floatAboveEverything(window)
  window.once('ready-to-show', () => window.showInactive())
  loadPage(window, 'widget')
  return window
}

function createPanel(): BrowserWindow {
  const window = new BrowserWindow({
    ...PANEL_SIZE,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Type NSPanel : seul ce type de fenêtre s'affiche au-dessus d'une app en plein écran.
    type: 'panel',
    webPreferences: securePreferences
  })
  floatAboveEverything(window)
  keepNavigationInApp(window)
  window.on('blur', () => {
    if (!panelOpen) return
    lastBlurCloseAt = Date.now()
    closePanel()
  })
  loadPage(window, 'panel')
  return window
}

let demo: BrowserWindow | null = null

export function openDemo(): void {
  if (demo) {
    demo.show()
    demo.focus()
    return
  }
  demo = new BrowserWindow({
    width: 960,
    height: 760,
    title: "Démo de l'avatar",
    webPreferences: securePreferences
  })
  demo.on('closed', () => {
    demo = null
  })
  loadPage(demo, 'demo')
}

export function sendWidgetAvatar(avatar: AvatarConfig): void {
  widget.webContents.send(IPC.widgetAvatar, avatar)
}

export function createWindows(): void {
  registerIpc()
  widget = createWidget()
  panel = createPanel()
  moveWidgetTo(getSettings().widget.corner, currentDisplay(), false)
  // Résolution modifiée ou écran débranché : l'icône revient à son coin.
  const replace = (): void => {
    closePanel()
    moveWidgetTo(getSettings().widget.corner, currentDisplay(), false)
  }
  screen.on('display-metrics-changed', replace)
  screen.on('display-removed', replace)
}
