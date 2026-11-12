import { EventEmitter } from 'events'
import {
  phaseMinutes,
  type Phase,
  type Settings,
  type TimerCommand,
  type TimerState
} from '../shared/types'

const MINUTE_MS = 60_000

export interface PhaseEndEvent {
  phase: Phase
  next: Phase
  /** When the phase was first started; null if it was skipped without ever running. */
  startedAt: number | null
  endedAt: number
  durationMs: number
  /** How much of the phase actually ran (all of it when completed). */
  elapsedMs: number
  /** False when skipped before the time ran out. */
  completed: boolean
  /** Whether the next phase started automatically. */
  autoStarted: boolean
}

interface TimerEvents {
  change: [TimerState]
  phaseEnd: [PhaseEndEvent]
}

/**
 * Pomodoro state machine: idle → running ⇄ paused, and focus → shortBreak/longBreak → focus.
 * Remaining time is derived from the `endsAt` timestamp rather than counted tick by tick,
 * so it stays accurate even if the event loop is delayed or the machine sleeps.
 */
export class PomodoroTimer extends EventEmitter<TimerEvents> {
  private state: TimerState
  private timeout: NodeJS.Timeout | null = null
  private phaseStartedAt: number | null = null

  constructor(private readonly getSettings: () => Settings) {
    super()
    this.state = this.freshState('focus', 0)
  }

  getState(): TimerState {
    const { state } = this
    if (state.status === 'running' && state.endsAt !== null) {
      return { ...state, remainingMs: Math.max(0, state.endsAt - Date.now()) }
    }
    return { ...state }
  }

  command(cmd: TimerCommand): void {
    switch (cmd) {
      case 'start':
        if (this.state.status === 'idle') this.run()
        break
      case 'pause':
        this.pause()
        break
      case 'resume':
        if (this.state.status === 'paused') this.run()
        break
      case 'skip':
        this.finishPhase(false)
        return
      case 'reset':
        this.reset()
        break
      case 'addMinute':
        this.addMinute()
        break
    }
    this.emitChange()
  }

  /** Re-checks whether the running phase is over, e.g. after the system resumes from sleep. */
  check(): void {
    const { status, endsAt } = this.state
    if (status !== 'running' || endsAt === null) return
    if (Date.now() >= endsAt) this.finishPhase(true)
    else this.arm()
  }

  /** An untouched idle phase picks up new durations right away; a started one keeps its time. */
  onSettingsChanged(): void {
    const { status, remainingMs, durationMs, phase, cycle } = this.state
    if (status !== 'idle' || remainingMs !== durationMs) return
    this.state = this.freshState(phase, cycle)
    this.emitChange()
  }

  dispose(): void {
    this.disarm()
  }

  private run(): void {
    const now = Date.now()
    this.state = { ...this.state, status: 'running', endsAt: now + this.state.remainingMs }
    this.phaseStartedAt ??= now
    this.arm()
  }

  private pause(): void {
    const { status, endsAt } = this.state
    if (status !== 'running' || endsAt === null) return
    this.disarm()
    this.state = {
      ...this.state,
      status: 'paused',
      endsAt: null,
      remainingMs: Math.max(0, endsAt - Date.now())
    }
  }

  /**
   * Restarts the current phase. Pressing reset again on an untouched phase goes back to the
   * first focus round of the set.
   */
  private reset(): void {
    this.disarm()
    this.phaseStartedAt = null
    const { status, remainingMs, durationMs, phase, cycle } = this.state
    const untouched = status === 'idle' && remainingMs === durationMs
    this.state = untouched ? this.freshState('focus', 0) : this.freshState(phase, cycle)
  }

  private addMinute(): void {
    const { state } = this
    if (state.status === 'running' && state.endsAt !== null) {
      this.state = {
        ...state,
        durationMs: state.durationMs + MINUTE_MS,
        endsAt: state.endsAt + MINUTE_MS
      }
      this.arm()
    } else {
      this.state = {
        ...state,
        durationMs: state.durationMs + MINUTE_MS,
        remainingMs: state.remainingMs + MINUTE_MS
      }
    }
  }

  /** Moves to the next phase. A skipped focus round still counts toward the long break. */
  private finishPhase(completed: boolean): void {
    const wasRunning = this.state.status === 'running'
    const remainingAtEnd = completed ? 0 : this.getState().remainingMs
    this.disarm()

    const settings = this.getSettings()
    const { phase, durationMs } = this.state
    let { cycle } = this.state
    let next: Phase
    if (phase === 'focus') {
      cycle += 1
      next = cycle >= settings.longBreakInterval ? 'longBreak' : 'shortBreak'
    } else {
      if (phase === 'longBreak') cycle = 0
      next = 'focus'
    }

    const startedAt = this.phaseStartedAt
    this.phaseStartedAt = null
    this.state = this.freshState(next, cycle)

    // A skip from idle/paused should not suddenly start the clock.
    const autoSetting = next === 'focus' ? settings.autoStartFocus : settings.autoStartBreaks
    const autoStarted = autoSetting && (completed || wasRunning)
    if (autoStarted) this.run()

    this.emit('phaseEnd', {
      phase,
      next,
      startedAt,
      endedAt: Date.now(),
      durationMs,
      elapsedMs: Math.max(0, durationMs - remainingAtEnd),
      completed,
      autoStarted
    })
    this.emitChange()
  }

  private freshState(phase: Phase, cycle: number): TimerState {
    const durationMs = phaseMinutes(this.getSettings(), phase) * MINUTE_MS
    return { phase, status: 'idle', durationMs, remainingMs: durationMs, endsAt: null, cycle }
  }

  private arm(): void {
    this.disarm()
    const { endsAt } = this.state
    if (endsAt === null) return
    this.timeout = setTimeout(() => this.check(), Math.max(0, endsAt - Date.now()))
  }

  private disarm(): void {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = null
  }

  private emitChange(): void {
    this.emit('change', this.getState())
  }
}
