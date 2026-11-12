import { Menu, Tray, nativeImage } from 'electron'
import { translator } from '../shared/i18n'
import type { Settings, TimerState } from '../shared/types'
import { encodePng } from './png'
import { drawRing } from './ringIcon'
import type { PomodoroTimer } from './timer'
import type { WindowManager } from './windows'

const ICON_PX = 32
/** The icon is redrawn only when the ring moves by at least one of these steps. */
const PROGRESS_STEPS = 60

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Tray icon whose ring fills in the phase color, with a tooltip showing the time left. */
export class AppTray {
  private readonly tray: Tray
  private iconKey = ''
  private menuKey = ''

  constructor(
    private readonly timer: PomodoroTimer,
    private readonly getSettings: () => Settings,
    private readonly windows: WindowManager,
    private readonly quit: () => void
  ) {
    this.tray = new Tray(nativeImage.createEmpty())
    this.tray.on('click', () => windows.toggleMain())
    this.update()
  }

  /** Cheap to call every second: icon and menu are rebuilt only when they would change. */
  update(): void {
    const state = this.timer.getState()
    const settings = this.getSettings()
    const t = translator(settings.language)
    const phase = t(`phase.${state.phase}`)
    const time = formatClock(state.remainingMs)

    const tooltip =
      state.status === 'running'
        ? t('tray.tooltipRunning', { phase, time })
        : state.status === 'paused'
          ? t('tray.tooltipPaused', { phase, time })
          : t('tray.tooltipIdle', { phase })
    this.tray.setToolTip(tooltip)

    // An idle timer shows a full ring; otherwise the ring empties as time runs out.
    const fraction = state.durationMs > 0 ? state.remainingMs / state.durationMs : 1
    const step = Math.ceil(fraction * PROGRESS_STEPS) / PROGRESS_STEPS
    const color = settings.phaseColors[state.phase]
    const iconKey = `${color}|${step}|${state.status}`
    if (iconKey !== this.iconKey) {
      this.iconKey = iconKey
      const pixels = drawRing({
        size: ICON_PX,
        color,
        fraction: step,
        trackAlpha: state.status === 'paused' ? 0.2 : 0.35,
        radius: 0.34,
        thickness: 0.22
      })
      this.tray.setImage(
        nativeImage.createFromBuffer(encodePng(ICON_PX, ICON_PX, pixels), { scaleFactor: 2 })
      )
    }

    const menuKey = `${settings.language}|${state.status}|${this.windows.isMiniVisible()}`
    if (menuKey !== this.menuKey) {
      this.menuKey = menuKey
      this.tray.setContextMenu(this.buildMenu(state, settings))
    }
  }

  destroy(): void {
    this.tray.destroy()
  }

  private buildMenu(state: TimerState, settings: Settings): Menu {
    const t = translator(settings.language)
    const primary =
      state.status === 'running'
        ? { label: t('tray.pause'), cmd: 'pause' as const }
        : state.status === 'paused'
          ? { label: t('tray.resume'), cmd: 'resume' as const }
          : { label: t('tray.start'), cmd: 'start' as const }
    return Menu.buildFromTemplate([
      { label: primary.label, click: () => this.timer.command(primary.cmd) },
      { label: t('tray.skip'), click: () => this.timer.command('skip') },
      { type: 'separator' },
      {
        label: t('tray.mini'),
        type: 'checkbox',
        checked: this.windows.isMiniVisible(),
        click: () => {
          this.windows.toggleMini()
          this.update()
        }
      },
      { label: t('tray.show'), click: () => this.windows.showMain() },
      { type: 'separator' },
      { label: t('tray.quit'), click: () => this.quit() }
    ])
  }
}
