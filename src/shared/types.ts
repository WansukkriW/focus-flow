export type Phase = 'focus' | 'shortBreak' | 'longBreak'

export type TimerStatus = 'idle' | 'running' | 'paused'

export type TimerCommand = 'start' | 'pause' | 'resume' | 'skip' | 'reset' | 'addMinute'

export interface TimerState {
  phase: Phase
  status: TimerStatus
  /** Full length of the current phase in ms, including any +1 minute additions. */
  durationMs: number
  /** Time left when not running. While running, derive it from `endsAt`. */
  remainingMs: number
  /** Epoch ms at which the current phase ends; only set while running. */
  endsAt: number | null
  /** Focus rounds finished in the current set, 0..longBreakInterval. */
  cycle: number
}

export type Language = 'th' | 'en'

export const THEME_IDS = ['midnight', 'aurora', 'ocean', 'forest', 'sunset'] as const
export type ThemeId = (typeof THEME_IDS)[number]

export const TIMER_STYLES = ['ring', 'hourglass'] as const
export type TimerStyle = (typeof TIMER_STYLES)[number]

export const CLOCK_FONTS = ['outfit', 'sora', 'spaceGrotesk', 'jetbrainsMono'] as const
export type ClockFont = (typeof CLOCK_FONTS)[number]

export const ALARM_SOUNDS = ['softBell', 'windChime', 'marimba', 'singingBowl'] as const
export type AlarmSound = (typeof ALARM_SOUNDS)[number]

export const AMBIENT_SOUNDS = [
  'brown',
  'pink',
  'rain',
  'ocean',
  'wind',
  'fireplace',
  'lofi'
] as const
export type AmbientSound = (typeof AMBIENT_SOUNDS)[number]

/** A sound file the user added; `file` is its name inside userData/sounds. */
export interface CustomSound {
  id: string
  name: string
  file: string
  kind: 'ambient' | 'alarm'
}

export interface Shortcuts {
  toggle: string
  skip: string
  mini: string
}

export type ShortcutState = 'ok' | 'conflict' | 'invalid' | 'empty'
export type ShortcutStatus = Record<keyof Shortcuts, ShortcutState>

export interface Settings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  /** Number of focus rounds before a long break. */
  longBreakInterval: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  notifications: boolean
  language: Language
  theme: ThemeId
  /** Custom accent color as #rrggbb, or null to use the theme's own accent. */
  accentColor: string | null
  /** Turns off decorative animation even if the OS doesn't ask for reduced motion. */
  reduceMotion: boolean
  /** Color of each phase as #rrggbb. */
  phaseColors: Record<Phase, string>
  timerStyle: TimerStyle
  clockFont: ClockFont
  /** Shows the countdown digits; some people find the numbers distracting. */
  showClock: boolean

  /** Closing the main window hides it to the tray instead of quitting. */
  closeToTray: boolean
  miniAutoOpen: boolean
  /** Last position of the mini window, or null to place it in the default corner. */
  miniPosition: { x: number; y: number } | null
  /** Electron accelerators; an empty string means unset. */
  shortcuts: Shortcuts

  activeTaskId: string | null
  showDoneTasks: boolean
  /** Focus rounds per day to aim for. */
  dailyGoal: number

  /** A built-in AlarmSound, a CustomSound id, or 'none'. */
  alarmSound: string
  /** 0..100 */
  alarmVolume: number
  /** Volume 0..100 per built-in AmbientSound or CustomSound id; 0 means off. */
  ambientVolumes: Record<string, number>
  ambientMode: 'focus' | 'always'
  customSounds: CustomSound[]
}

export interface Task {
  id: string
  title: string
  estimatedPomodoros: number
  completedPomodoros: number
  done: boolean
  createdAt: number
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'estimatedPomodoros' | 'done'>>

export interface Session {
  id: string
  type: Phase
  startedAt: number
  endedAt: number
  minutes: number
  taskId: string | null
  /** False when the phase was skipped before it ran out. */
  completed: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  notifications: true,
  language: 'th',
  theme: 'midnight',
  accentColor: null,
  reduceMotion: false,
  phaseColors: { focus: '#ff6b81', shortBreak: '#4fd1b5', longBreak: '#8b7cf6' },
  timerStyle: 'ring',
  clockFont: 'outfit',
  showClock: true,
  closeToTray: true,
  miniAutoOpen: false,
  miniPosition: null,
  shortcuts: { toggle: 'Control+Alt+P', skip: 'Control+Alt+S', mini: 'Control+Alt+M' },
  activeTaskId: null,
  showDoneTasks: false,
  dailyGoal: 8,
  alarmSound: 'softBell',
  alarmVolume: 70,
  ambientVolumes: {},
  ambientMode: 'focus',
  customSounds: []
}

type NumericSettingKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never
}[keyof Settings]

export const SETTINGS_LIMITS: Record<NumericSettingKey, { min: number; max: number }> = {
  focusMinutes: { min: 1, max: 120 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 120 },
  longBreakInterval: { min: 1, max: 12 },
  dailyGoal: { min: 1, max: 24 },
  alarmVolume: { min: 0, max: 100 }
}

export function phaseMinutes(settings: Settings, phase: Phase): number {
  switch (phase) {
    case 'focus':
      return settings.focusMinutes
    case 'shortBreak':
      return settings.shortBreakMinutes
    case 'longBreak':
      return settings.longBreakMinutes
  }
}

/**
 * Milliseconds until a countdown ending at `endsAt` shows its next whole second. Every clock
 * (main window, mini window, tray) ticks on this boundary so they change at the same moment.
 */
export function msUntilNextSecond(endsAt: number, now: number): number {
  const remaining = endsAt - now
  if (remaining <= 0) return 1000
  return (remaining % 1000 || 1000) + 5
}

/** What the renderer hears when a phase ends (for the alarm sound and the pulse). */
export interface PhaseEndInfo {
  phase: Phase
  next: Phase
  completed: boolean
  autoStarted: boolean
}

/** The API the preload script exposes on `window.api`. */
export interface FocusFlowApi {
  timer: {
    getState(): Promise<TimerState>
    command(cmd: TimerCommand): Promise<TimerState>
    onState(listener: (state: TimerState) => void): () => void
    onPhaseEnd(listener: (info: PhaseEndInfo) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
    onChange(listener: (settings: Settings) => void): () => void
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    onMaximizedChange(listener: (maximized: boolean) => void): () => void
  }
  tasks: {
    list(): Promise<Task[]>
    add(title: string, estimatedPomodoros: number): Promise<Task[]>
    update(id: string, patch: TaskPatch): Promise<Task[]>
    remove(id: string): Promise<Task[]>
    /** Saves a new order; `ids` lists every task in the order to keep. */
    reorder(ids: string[]): Promise<Task[]>
    onChange(listener: (tasks: Task[]) => void): () => void
  }
  history: {
    list(): Promise<Session[]>
    onChange(listener: (sessions: Session[]) => void): () => void
  }
  shortcuts: {
    status(): Promise<ShortcutStatus>
    onStatus(listener: (status: ShortcutStatus) => void): () => void
    /** Releases the global shortcuts while the user is recording a new one. */
    suspend(suspended: boolean): void
  }
  mini: {
    toggle(): void
    showMain(): void
    /**
     * Drags the mini window by hand (so double-click still reaches the page). Both take the
     * pointer's screen position; the main process works out where the window goes.
     */
    dragStart(screenX: number, screenY: number): void
    dragMove(screenX: number, screenY: number): void
  }
  sounds: {
    /** Lets the user pick a file, copies it into the app, and returns the updated settings. */
    add(kind: CustomSound['kind']): Promise<Settings | null>
    remove(id: string): Promise<Settings>
  }
}
