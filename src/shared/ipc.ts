/** IPC channel names shared by main and preload. */
export const IPC = {
  timerGet: 'timer:get',
  timerCommand: 'timer:command',
  timerState: 'timer:state',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsChanged: 'settings:changed',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowMaximizedChanged: 'window:maximized-changed',
  timerPhaseEnd: 'timer:phase-end',
  tasksList: 'tasks:list',
  tasksAdd: 'tasks:add',
  tasksUpdate: 'tasks:update',
  tasksRemove: 'tasks:remove',
  tasksReorder: 'tasks:reorder',
  tasksChanged: 'tasks:changed',
  historyList: 'history:list',
  historyChanged: 'history:changed',
  shortcutsStatus: 'shortcuts:status',
  shortcutsChanged: 'shortcuts:changed',
  shortcutsSuspend: 'shortcuts:suspend',
  miniToggle: 'mini:toggle',
  miniShowMain: 'mini:show-main',
  miniDragStart: 'mini:drag-start',
  miniDragMove: 'mini:drag-move',
  soundsAdd: 'sounds:add',
  soundsRemove: 'sounds:remove'
}

/** Custom URL scheme that serves the user's sound files to the renderer. */
export const SOUND_SCHEME = 'ffsound' as const
