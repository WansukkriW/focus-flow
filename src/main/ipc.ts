import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type { Settings, Task, TimerCommand, TimerState } from '../shared/types'
import type { GlobalShortcuts } from './shortcuts'
import { isAppUrl } from './security'
import { importSound, removeSound } from './sounds'
import type { Stores } from './store'
import { addTask, removeTask, reorderTasks, updateTask } from './tasks'
import type { PomodoroTimer } from './timer'
import type { WindowManager } from './windows'

const TIMER_COMMANDS: readonly TimerCommand[] = [
  'start',
  'pause',
  'resume',
  'skip',
  'reset',
  'addMinute'
]

export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export interface IpcContext {
  stores: Stores
  timer: PomodoroTimer
  windows: WindowManager
  shortcuts: GlobalShortcuts
  /** Validates, saves and broadcasts a settings change, and updates everything that depends on it. */
  updateSettings(patch: unknown): Settings
}

export function registerIpc({
  stores,
  timer,
  windows,
  shortcuts,
  updateSettings
}: IpcContext): void {
  handle(IPC.timerGet, (): TimerState => timer.getState())
  handle(IPC.timerCommand, (_e, cmd: unknown): TimerState => {
    if (!TIMER_COMMANDS.includes(cmd as TimerCommand)) {
      throw new Error(`Unknown timer command: ${String(cmd)}`)
    }
    timer.command(cmd as TimerCommand)
    return timer.getState()
  })

  handle(IPC.settingsGet, (): Settings => stores.settings.get())
  handle(IPC.settingsUpdate, (_e, patch: unknown): Settings => updateSettings(patch))

  // Tasks: every change is saved and pushed to all windows (the mini window shows the title).
  const tasksChanged = (tasks: Task[]): Task[] => {
    broadcast(IPC.tasksChanged, tasks)
    return tasks
  }
  handle(IPC.tasksList, () => stores.tasks.get())
  handle(IPC.tasksAdd, (_e, title: unknown, estimate: unknown) =>
    tasksChanged(addTask(stores, title, estimate))
  )
  handle(IPC.tasksUpdate, (_e, id: unknown, patch: unknown) => {
    const result = updateTask(stores, id, patch)
    if (result.settings) updateSettings(result.settings)
    return tasksChanged(result.tasks)
  })
  handle(IPC.tasksRemove, (_e, id: unknown) => {
    const result = removeTask(stores, id)
    if (result.settings) updateSettings(result.settings)
    return tasksChanged(result.tasks)
  })
  handle(IPC.tasksReorder, (_e, ids: unknown) => tasksChanged(reorderTasks(stores, ids)))

  handle(IPC.historyList, () => stores.history.get())

  handle(IPC.shortcutsStatus, () => shortcuts.status)
  on(IPC.shortcutsSuspend, (_e, suspended: unknown) => shortcuts.suspend(suspended === true))

  on(IPC.miniToggle, () => windows.toggleMini())
  on(IPC.miniShowMain, () => windows.showMain())
  on(IPC.miniDragStart, (_e, x: unknown, y: unknown) => windows.miniDragStart(Number(x), Number(y)))
  on(IPC.miniDragMove, (_e, x: unknown, y: unknown) => windows.miniDragMove(Number(x), Number(y)))
  handle(IPC.soundsAdd, async (e, kind: unknown) => {
    if (kind !== 'ambient' && kind !== 'alarm') return null
    const patch = await importSound(senderWindow(e), kind, stores.settings.get())
    return patch ? updateSettings(patch) : null
  })
  handle(IPC.soundsRemove, (_e, id: unknown) =>
    updateSettings(removeSound(String(id), stores.settings.get()))
  )

  // Controls for the custom title bar act on whichever window sent them.
  on(IPC.windowMinimize, (e) => senderWindow(e)?.minimize())
  on(IPC.windowToggleMaximize, (e) => {
    const win = senderWindow(e)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  on(IPC.windowClose, (e) => senderWindow(e)?.close())
  handle(IPC.windowIsMaximized, (e) => senderWindow(e)?.isMaximized() ?? false)
}

/** Rejects messages from any frame that isn't the app's own page. */
function trusted(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return isAppUrl(e.senderFrame?.url)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener<E> = (e: E, ...args: any[]) => unknown

function handle(channel: string, listener: Listener<IpcMainInvokeEvent>): void {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error(`Blocked IPC from untrusted frame: ${channel}`)
    return listener(e, ...args)
  })
}

function on(channel: string, listener: Listener<IpcMainEvent>): void {
  ipcMain.on(channel, (e, ...args) => {
    if (trusted(e)) listener(e, ...args)
  })
}

function senderWindow(e: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender)
}
