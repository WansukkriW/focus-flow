import { useEffect, useRef, useState } from 'react'
import {
  msUntilNextSecond,
  type Session,
  type Settings,
  type ShortcutStatus,
  type Task,
  type TimerState
} from '../../shared/types'
import { soundEngine } from './audio/engine'

/** Live timer state from the main process. */
export function useTimerState(): TimerState | null {
  const [state, setState] = useState<TimerState | null>(null)
  useEffect(() => {
    const unsubscribe = window.api.timer.onState(setState)
    window.api.timer.getState().then(setState)
    return unsubscribe
  }, [])
  return state
}

/** Remaining ms, recomputed from `endsAt` a few times a second while running. */
export function useRemainingMs(state: TimerState | null): number {
  const [now, setNow] = useState(() => Date.now())
  const endsAt = state?.status === 'running' ? state.endsAt : null
  useEffect(() => {
    if (endsAt === null) return
    let id = 0
    const tick = (): void => {
      setNow(Date.now())
      id = window.setTimeout(tick, msUntilNextSecond(endsAt, Date.now()))
    }
    tick()
    return () => window.clearTimeout(id)
  }, [endsAt])

  if (!state) return 0
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, state.endsAt - now)
  return state.remainingMs
}

export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    const unsubscribe = window.api.settings.onChange(setSettings)
    window.api.settings.get().then(setSettings)
    return unsubscribe
  }, [])
  const update = (patch: Partial<Settings>): void => {
    window.api.settings.update(patch).then(setSettings)
  }
  return [settings, update]
}

/** Share of the current phase still left, 0..1. */
export function fractionLeft(state: TimerState, now: number): number {
  if (state.durationMs <= 0) return 0
  const remaining =
    state.status === 'running' && state.endsAt !== null
      ? Math.max(0, state.endsAt - now)
      : state.remainingMs
  return Math.min(1, remaining / state.durationMs)
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function useTasks(): Task[] {
  const [tasks, setTasks] = useState<Task[]>([])
  useEffect(() => {
    const unsubscribe = window.api.tasks.onChange(setTasks)
    window.api.tasks.list().then(setTasks)
    return unsubscribe
  }, [])
  return tasks
}

export function useHistory(): Session[] {
  const [history, setHistory] = useState<Session[]>([])
  useEffect(() => {
    const unsubscribe = window.api.history.onChange(setHistory)
    window.api.history.list().then(setHistory)
    return unsubscribe
  }, [])
  return history
}

export function useShortcutStatus(): ShortcutStatus | null {
  const [status, setStatus] = useState<ShortcutStatus | null>(null)
  useEffect(() => {
    const unsubscribe = window.api.shortcuts.onStatus(setStatus)
    window.api.shortcuts.status().then(setStatus)
    return unsubscribe
  }, [])
  return status
}

/**
 * Drives the sound engine from app state: background sound follows the focus phase (or plays
 * all the time), and the chosen alarm rings when a phase runs out.
 */
export function useSounds(state: TimerState | null, settings: Settings | null): void {
  const latest = useRef(settings)
  useEffect(() => {
    latest.current = settings
  }, [settings])

  const focusing = state?.phase === 'focus' && state.status === 'running'
  const active = settings ? settings.ambientMode === 'always' || focusing : false
  const volumes = settings?.ambientVolumes
  const customs = settings?.customSounds
  useEffect(() => {
    const files = Object.fromEntries((customs ?? []).map((c) => [c.id, c.file]))
    soundEngine.setAmbient(active && volumes ? volumes : {}, files)
  }, [active, volumes, customs])

  useEffect(
    () =>
      window.api.timer.onPhaseEnd((info) => {
        const s = latest.current
        if (!s || !info.completed) return
        const custom = s.customSounds.find((c) => c.id === s.alarmSound)
        void soundEngine.playAlarm(s.alarmSound, s.alarmVolume, custom?.file)
      }),
    []
  )
}
