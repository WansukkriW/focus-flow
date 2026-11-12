import { app } from 'electron'
import { copyFileSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  ALARM_SOUNDS,
  AMBIENT_SOUNDS,
  DEFAULT_SETTINGS,
  CLOCK_FONTS,
  SETTINGS_LIMITS,
  THEME_IDS,
  TIMER_STYLES,
  type AlarmSound,
  type CustomSound,
  type Session,
  type Settings,
  type Task
} from '../shared/types'

const WRITE_DEBOUNCE_MS = 300

/**
 * One JSON file in userData. Writes are debounced and atomic: the data goes to a
 * temp file first and is then renamed over the real one, so a crash mid-write
 * never leaves a half-written file behind.
 */
class JsonStore<T> {
  private data: T
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly file: string,
    private readonly defaults: () => T,
    private readonly normalize: (raw: unknown) => T
  ) {
    this.data = this.load()
  }

  get(): T {
    return this.data
  }

  set(data: T): void {
    this.data = data
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), WRITE_DEBOUNCE_MS)
  }

  /** Writes pending changes now. Called on quit so nothing is lost. */
  flush(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
    try {
      writeAtomic(this.file, JSON.stringify(this.data, null, 2))
    } catch (err) {
      console.error(`Failed to save ${this.file}`, err)
    }
  }

  private load(): T {
    let text: string
    try {
      text = readFileSync(this.file, 'utf8')
    } catch {
      return this.defaults()
    }
    try {
      return this.normalize(JSON.parse(text))
    } catch (err) {
      // Keep the broken file for inspection instead of silently overwriting it.
      console.error(`Corrupt ${this.file}, starting from defaults`, err)
      try {
        renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
      } catch {
        // ignore
      }
      return this.defaults()
    }
  }
}

function writeAtomic(file: string, contents: string): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, contents, 'utf8')
  // On Windows the rename can fail briefly if another process (e.g. antivirus)
  // has the target open.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      renameSync(tmp, file)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') throw err
    }
  }
  copyFileSync(tmp, file)
  unlinkSync(tmp)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

/** Fills missing fields with defaults and clamps numbers into their allowed range. */
export function normalizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const input = isRecord(raw) ? raw : {}
  const result: Settings = { ...base }

  for (const key of Object.keys(SETTINGS_LIMITS) as (keyof typeof SETTINGS_LIMITS)[]) {
    const value = input[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      const { min, max } = SETTINGS_LIMITS[key]
      result[key] = Math.min(max, Math.max(min, Math.round(value)))
    }
  }
  const toggles = [
    'autoStartBreaks',
    'autoStartFocus',
    'notifications',
    'reduceMotion',
    'showClock',
    'closeToTray',
    'miniAutoOpen',
    'showDoneTasks'
  ] as const
  for (const key of toggles) {
    if (typeof input[key] === 'boolean') result[key] = input[key]
  }
  if (input.language === 'th' || input.language === 'en') result.language = input.language
  if (THEME_IDS.includes(input.theme as Settings['theme'])) {
    result.theme = input.theme as Settings['theme']
  }
  if (input.accentColor === null) {
    result.accentColor = null
  } else if (isHexColor(input.accentColor)) {
    result.accentColor = input.accentColor.toLowerCase()
  }
  if (isRecord(input.phaseColors)) {
    const colors = { ...result.phaseColors }
    for (const phase of Object.keys(colors) as (keyof typeof colors)[]) {
      const value = input.phaseColors[phase]
      if (isHexColor(value)) colors[phase] = value.toLowerCase()
    }
    result.phaseColors = colors
  }
  if (TIMER_STYLES.includes(input.timerStyle as Settings['timerStyle'])) {
    result.timerStyle = input.timerStyle as Settings['timerStyle']
  }
  if (CLOCK_FONTS.includes(input.clockFont as Settings['clockFont'])) {
    result.clockFont = input.clockFont as Settings['clockFont']
  }

  if (input.miniPosition === null) {
    result.miniPosition = null
  } else if (
    isRecord(input.miniPosition) &&
    Number.isFinite(input.miniPosition.x) &&
    Number.isFinite(input.miniPosition.y)
  ) {
    result.miniPosition = {
      x: Math.round(input.miniPosition.x as number),
      y: Math.round(input.miniPosition.y as number)
    }
  }
  if (isRecord(input.shortcuts)) {
    const shortcuts = { ...result.shortcuts }
    for (const key of Object.keys(shortcuts) as (keyof typeof shortcuts)[]) {
      const value = input.shortcuts[key]
      if (typeof value === 'string' && value.length <= 60) shortcuts[key] = value
    }
    result.shortcuts = shortcuts
  }
  if (input.activeTaskId === null || typeof input.activeTaskId === 'string') {
    result.activeTaskId = input.activeTaskId
  }

  if (input.ambientMode === 'focus' || input.ambientMode === 'always') {
    result.ambientMode = input.ambientMode
  }
  if (Array.isArray(input.customSounds)) {
    result.customSounds = input.customSounds.filter(
      (c): c is CustomSound =>
        isRecord(c) &&
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        typeof c.file === 'string' &&
        (c.kind === 'ambient' || c.kind === 'alarm')
    )
  }
  // After customSounds, so only built-in sounds and the user's own ambient files are kept.
  const ambientIds = new Set<string>([
    ...AMBIENT_SOUNDS,
    ...result.customSounds.filter((c) => c.kind === 'ambient').map((c) => c.id)
  ])
  const volumeSource = isRecord(input.ambientVolumes) ? input.ambientVolumes : result.ambientVolumes
  const volumes: Record<string, number> = {}
  for (const [id, value] of Object.entries(volumeSource)) {
    if (ambientIds.has(id) && typeof value === 'number' && Number.isFinite(value) && value > 0) {
      volumes[id] = Math.min(100, Math.round(value))
    }
  }
  result.ambientVolumes = volumes

  // Checked after customSounds so a removed custom alarm falls back to the default.
  if (typeof input.alarmSound === 'string') result.alarmSound = input.alarmSound
  const knownAlarm =
    result.alarmSound === 'none' ||
    ALARM_SOUNDS.includes(result.alarmSound as AlarmSound) ||
    result.customSounds.some((c) => c.id === result.alarmSound && c.kind === 'alarm')
  if (!knownAlarm) result.alarmSound = DEFAULT_SETTINGS.alarmSound

  return result
}

function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((t) => isRecord(t) && typeof t.id === 'string' && typeof t.title === 'string')
    .map((t) => ({
      id: t.id as string,
      title: t.title as string,
      estimatedPomodoros: clampInt(t.estimatedPomodoros, 1, 99, 1),
      completedPomodoros: clampInt(t.completedPomodoros, 0, 9999, 0),
      done: t.done === true,
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now()
    }))
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalizeHistory(raw: unknown): Session[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is Session => isRecord(s) && typeof s.id === 'string' && typeof s.type === 'string'
  )
}

export interface Stores {
  settings: JsonStore<Settings>
  tasks: JsonStore<Task[]>
  history: JsonStore<Session[]>
  flushAll(): void
}

export function createStores(): Stores {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })

  const settings = new JsonStore(
    join(dir, 'settings.json'),
    () => ({ ...DEFAULT_SETTINGS }),
    (raw) => normalizeSettings(raw)
  )
  const tasks = new JsonStore(join(dir, 'tasks.json'), () => [], normalizeTasks)
  const history = new JsonStore(join(dir, 'history.json'), () => [], normalizeHistory)

  return {
    settings,
    tasks,
    history,
    flushAll() {
      settings.flush()
      tasks.flush()
      history.flush()
    }
  }
}
