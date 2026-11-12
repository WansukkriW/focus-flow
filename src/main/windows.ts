import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc'
import type { Settings } from '../shared/types'
import icon from '../../resources/icon.png?asset'

const MINI_SIZE = { width: 236, height: 76 }
const MINI_MARGIN = 24

const SECURE_PREFS = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}

function loadRenderer(win: BrowserWindow, hash?: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash ? `#${hash}` : ''))
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

/** Keeps a saved position on a display that still exists; otherwise uses the default corner. */
function miniPosition(saved: Settings['miniPosition']): { x: number; y: number } {
  if (saved) {
    const area = screen.getDisplayMatching({ ...saved, ...MINI_SIZE }).workArea
    const visible =
      saved.x >= area.x - MINI_SIZE.width / 2 &&
      saved.y >= area.y &&
      saved.x + MINI_SIZE.width / 2 <= area.x + area.width &&
      saved.y + MINI_SIZE.height <= area.y + area.height
    if (visible) return saved
  }
  const area = screen.getPrimaryDisplay().workArea
  return {
    x: area.x + area.width - MINI_SIZE.width - MINI_MARGIN,
    y: area.y + area.height - MINI_SIZE.height - MINI_MARGIN
  }
}

/** Owns the main window and the always-on-top mini window. */
export class WindowManager {
  main: BrowserWindow | null = null
  mini: BrowserWindow | null = null
  /** Set once the user really quits, so closing stops hiding to the tray. */
  quitting = false

  constructor(
    private readonly getSettings: () => Settings,
    private readonly saveMiniPosition: (position: { x: number; y: number }) => void
  ) {}

  createMain(): BrowserWindow {
    const win = new BrowserWindow({
      width: 440,
      height: 720,
      minWidth: 380,
      minHeight: 640,
      show: false,
      frame: false,
      backgroundColor: '#0b0d14',
      title: 'Focus Flow',
      icon,
      // Throttling stays on: background audio runs on its own thread and the end-of-phase
      // alarm arrives by IPC, so a hidden window can safely idle.
      webPreferences: SECURE_PREFS
    })

    win.on('ready-to-show', () => win.show())
    const sendMaximized = (): void =>
      win.webContents.send(IPC.windowMaximizedChanged, win.isMaximized())
    win.on('maximize', sendMaximized)
    win.on('unmaximize', sendMaximized)

    win.on('close', (e) => {
      if (!this.quitting && this.getSettings().closeToTray) {
        e.preventDefault()
        win.hide()
      }
    })
    win.on('closed', () => {
      if (this.main === win) this.main = null
      // Without close-to-tray, closing the main window means quitting, even if the
      // (hidden) mini window still exists.
      if (!this.quitting) app.quit()
    })

    loadRenderer(win)
    this.main = win
    return win
  }

  showMain(): void {
    const win = this.main ?? this.createMain()
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  /** Tray left-click: bring the window up, or tuck it away if it is already in front. */
  toggleMain(): void {
    const win = this.main
    if (win && win.isVisible() && !win.isMinimized() && win.isFocused()) win.hide()
    else this.showMain()
  }

  showMini(): void {
    const win = this.mini ?? this.createMini()
    win.showInactive()
  }

  hideMini(): void {
    this.mini?.hide()
  }

  toggleMini(): void {
    if (this.mini?.isVisible()) this.hideMini()
    else this.showMini()
  }

  isMiniVisible(): boolean {
    return this.mini?.isVisible() ?? false
  }

  private drag: { winX: number; winY: number; x: number; y: number } | null = null

  miniDragStart(x: number, y: number): void {
    if (!this.mini || !Number.isFinite(x) || !Number.isFinite(y)) return
    const [winX, winY] = this.mini.getPosition()
    this.drag = { winX, winY, x, y }
  }

  /** Moves by how far the pointer travelled since the drag began, and remembers the spot. */
  miniDragMove(x: number, y: number): void {
    const d = this.drag
    if (!this.mini || !d || !Number.isFinite(x) || !Number.isFinite(y)) return
    const nx = Math.round(d.winX + x - d.x)
    const ny = Math.round(d.winY + y - d.y)
    this.mini.setPosition(nx, ny)
    // 'moved' only fires for native moves, so save here (the store debounces the write).
    this.saveMiniPosition({ x: nx, y: ny })
  }

  /** Closes every window for real (used when quitting). */
  destroyAll(): void {
    this.quitting = true
    this.mini?.destroy()
    this.main?.destroy()
  }

  private createMini(): BrowserWindow {
    const { x, y } = miniPosition(this.getSettings().miniPosition)
    const win = new BrowserWindow({
      ...MINI_SIZE,
      x,
      y,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      title: 'Focus Flow Mini',
      webPreferences: SECURE_PREFS
    })
    // Above normal windows, but below system UI such as the Start menu.
    win.setAlwaysOnTop(true, 'floating')
    win.on('moved', () => {
      const [mx, my] = win.getPosition()
      this.saveMiniPosition({ x: mx, y: my })
    })
    win.on('close', (e) => {
      if (!this.quitting) {
        e.preventDefault()
        win.hide()
      }
    })
    win.on('closed', () => {
      if (this.mini === win) this.mini = null
    })
    loadRenderer(win, 'mini')
    this.mini = win
    return win
  }
}
