import { app, powerMonitor } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipc'
import {
  msUntilNextSecond,
  type PhaseEndInfo,
  type Settings,
  type TimerStatus
} from '../shared/types'
import { broadcast, registerIpc } from './ipc'
import { notifyPhaseEnd } from './notifications'
import { GlobalShortcuts } from './shortcuts'
import { hardenWebContents } from './security'
import { registerSoundScheme, serveSounds } from './sounds'
import { createStores, normalizeSettings } from './store'
import { recordPhaseEnd } from './tasks'
import { PomodoroTimer } from './timer'
import { AppTray } from './tray'
import { WindowManager } from './windows'

const APP_ID = 'com.fickeryook.focusflow'

registerSoundScheme()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(start)
}

function start(): void {
  electronApp.setAppUserModelId(APP_ID)
  // F12 toggles DevTools in development; Ctrl+R reload is blocked in production.
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  hardenWebContents()
  serveSounds()

  const stores = createStores()
  const getSettings = (): Settings => stores.settings.get()
  const timer = new PomodoroTimer(getSettings)
  const windows = new WindowManager(getSettings, (miniPosition) =>
    stores.settings.set({ ...getSettings(), miniPosition })
  )

  const quit = (): void => {
    windows.quitting = true
    app.quit()
  }
  const tray = new AppTray(timer, getSettings, windows, quit)

  const shortcuts = new GlobalShortcuts(
    {
      toggle: () => {
        const { status } = timer.getState()
        timer.command(status === 'running' ? 'pause' : status === 'paused' ? 'resume' : 'start')
      },
      skip: () => timer.command('skip'),
      mini: () => {
        windows.toggleMini()
        tray.update()
      }
    },
    (status) => broadcast(IPC.shortcutsChanged, status)
  )
  shortcuts.apply(getSettings().shortcuts)

  const updateSettings = (patch: unknown): Settings => {
    const current = getSettings()
    const next = normalizeSettings(
      { ...current, ...(typeof patch === 'object' && patch !== null ? patch : {}) },
      current
    )
    stores.settings.set(next)
    timer.onSettingsChanged()
    if (JSON.stringify(next.shortcuts) !== JSON.stringify(current.shortcuts)) {
      shortcuts.apply(next.shortcuts)
    }
    broadcast(IPC.settingsChanged, next)
    tray.update()
    return next
  }

  registerIpc({ stores, timer, windows, shortcuts, updateSettings })

  let lastStatus: TimerStatus = timer.getState().status
  timer.on('change', (state) => {
    broadcast(IPC.timerState, state)
    // Starting a focus round can pop up the mini window.
    if (
      state.phase === 'focus' &&
      state.status === 'running' &&
      lastStatus === 'idle' &&
      getSettings().miniAutoOpen
    ) {
      windows.showMini()
    }
    lastStatus = state.status
    tray.update()
  })

  timer.on('phaseEnd', (event) => {
    const changed = recordPhaseEnd(stores, event)
    if (changed.history) broadcast(IPC.historyChanged, stores.history.get())
    if (changed.tasks) broadcast(IPC.tasksChanged, stores.tasks.get())
    const info: PhaseEndInfo = {
      phase: event.phase,
      next: event.next,
      completed: event.completed,
      autoStarted: event.autoStarted
    }
    broadcast(IPC.timerPhaseEnd, info)
    if (event.completed) notifyPhaseEnd(event, getSettings(), () => windows.showMain())
  })

  powerMonitor.on('resume', () => timer.check())
  // The tooltip shows seconds; refresh it exactly when the displayed second changes.
  let trayTicker: NodeJS.Timeout | undefined
  const scheduleTrayTick = (): void => {
    clearTimeout(trayTicker)
    const { status, endsAt } = timer.getState()
    if (status !== 'running' || endsAt === null) return
    trayTicker = setTimeout(
      () => {
        tray.update()
        scheduleTrayTick()
      },
      msUntilNextSecond(endsAt, Date.now())
    )
  }
  timer.on('change', scheduleTrayTick)

  app.on('second-instance', () => windows.showMain())
  app.on('before-quit', () => {
    windows.quitting = true
  })
  app.on('window-all-closed', () => {
    // With close-to-tray the windows are only hidden, so this means a real quit.
    app.quit()
  })
  app.on('will-quit', () => {
    clearTimeout(trayTicker)
    shortcuts.dispose()
    tray.destroy()
    timer.dispose()
    stores.flushAll()
  })

  windows.createMain()
}
