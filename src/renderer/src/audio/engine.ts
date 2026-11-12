import { SOUND_SCHEME } from '../../../shared/ipc'
import type { AlarmSound, AmbientSound } from '../../../shared/types'
import { SAMPLE_RATE, brownNoise, fireplace, lofiPad, ocean, pinkNoise, rain, wind } from './synth'

const BUILT_IN: Record<AmbientSound, () => Float32Array | Promise<AudioBuffer>> = {
  brown: brownNoise,
  pink: pinkNoise,
  rain,
  ocean,
  wind,
  fireplace,
  lofi: lofiPad
}

/** Time constants for setTargetAtTime: about 3× this to reach the target. */
const FADE_IN = 0.6
const FADE_OUT = 0.35
const PREVIEW_SECONDS = 4
/** With nothing playing for this long, the audio device is released (saves CPU and power). */
const IDLE_SUSPEND_MS = 3000
/** Generated or decoded sounds not played for this long are dropped from memory. */
const BUFFER_TTL_MS = 2 * 60 * 1000

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  /** Target 0..1 the user picked. */
  level: number
}

/** Perceived loudness is roughly logarithmic, so square the slider value. */
function toGain(volume0to100: number): number {
  const v = Math.max(0, Math.min(100, volume0to100)) / 100
  return v * v
}

/**
 * Plays the ambient mix and the end-of-phase sounds. Every start and stop is a short gain
 * ramp, never a hard cut, so there are no clicks.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null
  private buffers = new Map<string, Promise<AudioBuffer>>()
  private voices = new Map<string, Voice>()
  /** Ambient targets requested by the app (focus running, mode, volumes). */
  private wanted: Record<string, number> = {}
  private previews = new Map<string, number>()
  /** Until when an alarm may still be ringing (ms since epoch). */
  private busyUntil = 0
  private idleTimer = 0
  private evictTimers = new Map<string, number>()

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext({ latencyHint: 'playback' })
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** Suspends the AudioContext once no ambient sound plays and no alarm is ringing. */
  private scheduleIdle(): void {
    window.clearTimeout(this.idleTimer)
    const wait = Math.max(IDLE_SUSPEND_MS, this.busyUntil - Date.now() + 500)
    this.idleTimer = window.setTimeout(() => {
      if (this.voices.size === 0 && Date.now() >= this.busyUntil && this.ctx?.state === 'running') {
        void this.ctx.suspend()
      }
    }, wait)
  }

  /** Forgets a sound's samples if it stays unused, so idle memory stays small. */
  private scheduleEvict(id: string): void {
    window.clearTimeout(this.evictTimers.get(id))
    this.evictTimers.set(
      id,
      window.setTimeout(() => {
        this.evictTimers.delete(id)
        if (!this.voices.has(id)) this.buffers.delete(id)
      }, BUFFER_TTL_MS)
    )
  }

  private buffer(id: string, file?: string): Promise<AudioBuffer> {
    window.clearTimeout(this.evictTimers.get(id))
    let promise = this.buffers.get(id)
    if (!promise) {
      promise = this.load(id, file)
      this.buffers.set(id, promise)
      promise.catch(() => this.buffers.delete(id))
    }
    return promise
  }

  private async load(id: string, file?: string): Promise<AudioBuffer> {
    const ctx = this.context()
    if (file) {
      const res = await fetch(`${SOUND_SCHEME}://sound/${encodeURIComponent(file)}`)
      return ctx.decodeAudioData(await res.arrayBuffer())
    }
    const made = await BUILT_IN[id as AmbientSound]()
    if (made instanceof AudioBuffer) return made
    const buf = ctx.createBuffer(1, made.length, SAMPLE_RATE)
    buf.copyToChannel(made as Float32Array<ArrayBuffer>, 0)
    return buf
  }

  /**
   * Sets which ambient sounds should be playing and how loud (0..100 each).
   * `files` maps custom sound ids to their file names.
   */
  setAmbient(levels: Record<string, number>, files: Record<string, string> = {}): void {
    this.wanted = levels
    this.files = files
    this.sync()
  }

  private files: Record<string, string> = {}

  /** Plays one ambient sound for a few seconds so the user can hear it from Settings. */
  previewAmbient(id: string, volume: number, file?: string): void {
    if (file) this.files[id] = file
    window.clearTimeout(this.previews.get(id))
    this.previews.set(
      id,
      window.setTimeout(() => {
        this.previews.delete(id)
        this.sync()
      }, PREVIEW_SECONDS * 1000)
    )
    this.sync({ [id]: Math.max(volume, 30) })
  }

  private sync(extra: Record<string, number> = {}): void {
    const targets: Record<string, number> = { ...this.wanted }
    for (const [id, level] of Object.entries(extra)) targets[id] = Math.max(targets[id] ?? 0, level)
    // Keep a running preview alive while the user keeps adjusting the slider.
    for (const id of this.previews.keys()) {
      if (!(id in targets) && this.voices.has(id)) targets[id] = this.voices.get(id)!.level * 100
    }

    for (const [id, voice] of this.voices) {
      const level = targets[id] ?? 0
      if (level > 0) this.ramp(voice, toGain(level), FADE_IN)
      else this.stopVoice(id)
    }
    for (const [id, level] of Object.entries(targets)) {
      if (level > 0 && !this.voices.has(id)) void this.startVoice(id, level)
    }
  }

  private ramp(voice: Voice, gain: number, tau: number): void {
    const ctx = this.context()
    voice.level = Math.sqrt(gain)
    voice.gain.gain.cancelScheduledValues(ctx.currentTime)
    voice.gain.gain.setTargetAtTime(gain, ctx.currentTime, tau)
  }

  private async startVoice(id: string, level: number): Promise<void> {
    const ctx = this.context()
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)
    const source = ctx.createBufferSource()
    source.loop = true
    // Reserve the slot now so a second sync while loading doesn't start it twice.
    const voice: Voice = { source, gain, level: 0 }
    this.voices.set(id, voice)
    try {
      source.buffer = await this.buffer(id, this.files[id])
    } catch (err) {
      console.error(`Could not load sound ${id}`, err)
      this.voices.delete(id)
      gain.disconnect()
      return
    }
    if (this.voices.get(id) !== voice) return // stopped while loading
    source.connect(gain)
    // Start at a random point so two sessions don't always open the same way.
    source.start(0, Math.random() * source.buffer.duration)
    this.ramp(voice, toGain(level), FADE_IN)
  }

  private stopVoice(id: string): void {
    const voice = this.voices.get(id)
    if (!voice) return
    this.voices.delete(id)
    const ctx = this.context()
    voice.gain.gain.cancelScheduledValues(ctx.currentTime)
    voice.gain.gain.setTargetAtTime(0, ctx.currentTime, FADE_OUT)
    try {
      voice.source.stop(ctx.currentTime + FADE_OUT * 6)
    } catch {
      // Never started (still loading).
    }
    window.setTimeout(() => voice.gain.disconnect(), (FADE_OUT * 6 + 0.2) * 1000)
    this.scheduleEvict(id)
    this.scheduleIdle()
  }

  /** Plays an end-of-phase sound: a built-in AlarmSound or a custom file. */
  async playAlarm(id: string, volume: number, file?: string): Promise<void> {
    if (id === 'none' || volume <= 0) return
    // Built-in alarms ring for at most ~8 s; files are cut at 12 s.
    this.busyUntil = Date.now() + (file ? 13_000 : 9_000)
    this.scheduleIdle()
    const ctx = this.context()
    const out = ctx.createGain()
    out.gain.value = toGain(volume)
    out.connect(ctx.destination)
    const t = ctx.currentTime + 0.03

    if (file) {
      const source = ctx.createBufferSource()
      source.buffer = await this.buffer(id, file)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(1, t + 0.01)
      // Long files are cut after 12 s with a gentle fade.
      env.gain.setValueAtTime(1, t + 11)
      env.gain.linearRampToValueAtTime(0, t + 12)
      source.connect(env).connect(out)
      source.start(t)
      source.stop(t + 12)
      this.scheduleEvict(id)
      return
    }
    ALARMS[id as AlarmSound]?.(ctx, out, t)
  }
}

type Partial3 = [ratio: number, amp: number, decayScale: number]

/** One struck note: a few sine partials, each with a fast attack and exponential decay. */
function strike(
  ctx: AudioContext,
  out: AudioNode,
  when: number,
  freq: number,
  decay: number,
  partials: Partial3[],
  level = 1,
  attack = 0.006,
  detuneHz = 0
): void {
  for (const [ratio, amp, decayScale] of partials) {
    for (const spread of detuneHz ? [-detuneHz, detuneHz] : [0]) {
      const osc = ctx.createOscillator()
      osc.frequency.value = freq * ratio + spread
      const g = ctx.createGain()
      const peak = (amp * level) / (detuneHz ? 2 : 1)
      const length = decay * decayScale
      g.gain.setValueAtTime(0, when)
      g.gain.linearRampToValueAtTime(peak, when + attack)
      g.gain.exponentialRampToValueAtTime(0.0001, when + attack + length)
      osc.connect(g).connect(out)
      osc.start(when)
      osc.stop(when + attack + length + 0.05)
    }
  }
}

const BELL: Partial3[] = [
  [1, 0.5, 1],
  [2, 0.18, 0.6],
  [3, 0.08, 0.4],
  [4.2, 0.04, 0.3]
]

const ALARMS: Record<AlarmSound, (ctx: AudioContext, out: AudioNode, t: number) => void> = {
  softBell: (ctx, out, t) => {
    strike(ctx, out, t, 784, 2.6, BELL)
    strike(ctx, out, t + 0.9, 988, 3, BELL, 0.85)
  },
  windChime: (ctx, out, t) => {
    const notes = [1047, 1175, 1319, 1568, 1760, 2093]
    const times = [0, 0.18, 0.42, 0.6, 0.95, 1.3, 1.55]
    times.forEach((dt, i) => {
      const freq = notes[(i * 4 + 1) % notes.length]
      strike(
        ctx,
        out,
        t + dt,
        freq,
        2.8,
        [
          [1, 0.32, 1],
          [2.76, 0.1, 0.5],
          [5.4, 0.04, 0.25]
        ],
        0.6 + ((i * 7) % 5) / 10
      )
    })
  },
  marimba: (ctx, out, t) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      strike(
        ctx,
        out,
        t + i * 0.14,
        freq,
        0.7,
        [
          [1, 0.55, 1],
          [4, 0.14, 0.18],
          [9.9, 0.04, 0.06]
        ],
        1,
        0.003
      )
    })
  },
  singingBowl: (ctx, out, t) => {
    // Paired, slightly detuned partials make the slow "wah" beating of a real bowl.
    strike(
      ctx,
      out,
      t,
      196,
      7,
      [
        [1, 0.5, 1],
        [2.71, 0.28, 0.8],
        [5.15, 0.12, 0.55],
        [8.9, 0.05, 0.35]
      ],
      1,
      0.04,
      0.9
    )
  }
}

/** One engine per window; only the main window plays sound. */
export const soundEngine = new SoundEngine()
