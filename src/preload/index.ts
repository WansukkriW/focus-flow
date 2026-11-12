import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  FocusFlowApi,
  PhaseEndInfo,
  Session,
  Settings,
  ShortcutStatus,
  Task,
  TimerState
} from '../shared/types'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// Only this narrow API is exposed; the renderer never touches ipcRenderer directly.
const api: FocusFlowApi = {
  timer: {
    getState: () => ipcRenderer.invoke(IPC.timerGet),
    command: (cmd) => ipcRenderer.invoke(IPC.timerCommand, cmd),
    onState: (listener) => subscribe<TimerState>(IPC.timerState, listener),
    onPhaseEnd: (listener) => subscribe<PhaseEndInfo>(IPC.timerPhaseEnd, listener)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch),
    onChange: (listener) => subscribe<Settings>(IPC.settingsChanged, listener)
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    close: () => ipcRenderer.send(IPC.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized),
    onMaximizedChange: (listener) => subscribe<boolean>(IPC.windowMaximizedChanged, listener)
  },
  tasks: {
    list: () => ipcRenderer.invoke(IPC.tasksList),
    add: (title, estimate) => ipcRenderer.invoke(IPC.tasksAdd, title, estimate),
    update: (id, patch) => ipcRenderer.invoke(IPC.tasksUpdate, id, patch),
    remove: (id) => ipcRenderer.invoke(IPC.tasksRemove, id),
    reorder: (ids) => ipcRenderer.invoke(IPC.tasksReorder, ids),
    onChange: (listener) => subscribe<Task[]>(IPC.tasksChanged, listener)
  },
  history: {
    list: () => ipcRenderer.invoke(IPC.historyList),
    onChange: (listener) => subscribe<Session[]>(IPC.historyChanged, listener)
  },
  shortcuts: {
    status: () => ipcRenderer.invoke(IPC.shortcutsStatus),
    onStatus: (listener) => subscribe<ShortcutStatus>(IPC.shortcutsChanged, listener),
    suspend: (suspended) => ipcRenderer.send(IPC.shortcutsSuspend, suspended)
  },
  mini: {
    toggle: () => ipcRenderer.send(IPC.miniToggle),
    showMain: () => ipcRenderer.send(IPC.miniShowMain),
    dragStart: (x, y) => ipcRenderer.send(IPC.miniDragStart, x, y),
    dragMove: (x, y) => ipcRenderer.send(IPC.miniDragMove, x, y)
  },
  sounds: {
    add: (kind) => ipcRenderer.invoke(IPC.soundsAdd, kind),
    remove: (id) => ipcRenderer.invoke(IPC.soundsRemove, id)
  }
}

contextBridge.exposeInMainWorld('api', api)
