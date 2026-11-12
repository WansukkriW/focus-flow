/**
 * Procedural sound generators. Each returns mono samples for a loop that repeats without a
 * seam: generators either use periods that divide the loop length, or are cross-faded at
 * the joint by `loopable()`.
 */

export const SAMPLE_RATE = 44_100

type Rng = () => number

/** Small seeded PRNG so every sound is the same each time it is generated. */
function rng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates `seconds` + a short tail, then blends the tail into the start so the end flows
 * straight back into the beginning.
 */
function loopable(
  seconds: number,
  fill: (out: Float32Array) => void,
  fadeSeconds = 0.5
): Float32Array {
  const n = Math.round(seconds * SAMPLE_RATE)
  const f = Math.round(fadeSeconds * SAMPLE_RATE)
  const raw = new Float32Array(n + f)
  fill(raw)
  const out = raw.slice(0, n)
  for (let i = 0; i < f; i++) {
    const a = i / f
    // Equal-power crossfade keeps the loudness steady through the joint.
    out[i] = raw[i] * Math.sin((a * Math.PI) / 2) + raw[n + i] * Math.cos((a * Math.PI) / 2)
  }
  return out
}

function normalize(data: Float32Array, peak = 0.9): Float32Array {
  let max = 0
  for (const v of data) max = Math.max(max, Math.abs(v))
  if (max > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i] / max) * peak
  return data
}

function white(r: Rng): number {
  return r() * 2 - 1
}

/** Paul Kellet's economy pink-noise filter. */
function pinkSource(r: Rng): () => number {
  let b0 = 0
  let b1 = 0
  let b2 = 0
  return () => {
    const w = white(r)
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57 * b2 + w * 1.0526913
    return (b0 + b1 + b2 + w * 0.1848) * 0.2
  }
}

function brownSource(r: Rng): () => number {
  let last = 0
  return () => {
    last = (last + 0.02 * white(r)) / 1.02
    return last * 3.5
  }
}

/** One-pole low-pass; `cut` is 0..1 (higher = brighter). */
function lowpass(): (x: number, cut: number) => number {
  let y = 0
  return (x, cut) => (y += cut * (x - y))
}

function cutoff(hz: number): number {
  return 1 - Math.exp((-2 * Math.PI * hz) / SAMPLE_RATE)
}

export function brownNoise(): Float32Array {
  return normalize(
    loopable(10, (out) => {
      const src = brownSource(rng(1))
      const lp = lowpass()
      const c = cutoff(900)
      for (let i = 0; i < out.length; i++) out[i] = lp(src(), c)
    }),
    0.7
  )
}

export function pinkNoise(): Float32Array {
  return normalize(
    loopable(10, (out) => {
      const src = pinkSource(rng(2))
      for (let i = 0; i < out.length; i++) out[i] = src()
    }),
    0.5
  )
}

/** Soft hiss of distant rain plus scattered close drops. */
export function rain(): Float32Array {
  return normalize(
    loopable(12, (out) => {
      const r = rng(3)
      const src = pinkSource(r)
      const lp = lowpass()
      const hp = lowpass()
      const cLow = cutoff(6000)
      const cHigh = cutoff(500)
      for (let i = 0; i < out.length; i++) {
        const x = lp(src(), cLow)
        out[i] = (x - hp(x, cHigh)) * 0.5
      }
      // Drops: short decaying blips at random pitches and loudness.
      const drops = Math.round((out.length / SAMPLE_RATE) * 45)
      for (let d = 0; d < drops; d++) {
        const start = Math.floor(r() * out.length)
        const freq = 1800 + r() * 3500
        const amp = 0.05 + r() ** 3 * 0.35
        const decay = 0.004 + r() * 0.012
        const len = Math.floor(decay * 6 * SAMPLE_RATE)
        for (let k = 0; k < len && start + k < out.length; k++) {
          const t = k / SAMPLE_RATE
          out[start + k] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / decay) * amp
        }
      }
    }),
    0.6
  )
}

/** Waves: noise that swells and recedes, getting brighter as each wave breaks. */
export function ocean(): Float32Array {
  // Two 8-second waves, so the swell repeats exactly at the loop point.
  const period = 8
  return normalize(
    loopable(
      16,
      (out) => {
        const src = brownSource(rng(4))
        const pink = pinkSource(rng(5))
        const lp = lowpass()
        for (let i = 0; i < out.length; i++) {
          const t = i / SAMPLE_RATE
          const phase = (t % period) / period
          const swell = Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * phase), 1.6)
          const env = 0.15 + 0.85 * swell
          const x = src() * 0.6 + pink() * 0.6
          out[i] = lp(x, cutoff(250 + 1600 * swell)) * env
        }
      },
      0.01
    ),
    0.65
  )
}

/** Wind: a resonant band of noise whose pitch and strength drift with the gusts. */
export function wind(): Float32Array {
  const seconds = 24
  return normalize(
    loopable(
      seconds,
      (out) => {
        const r = rng(6)
        // State-variable band-pass filter.
        let low = 0
        let band = 0
        const q = 0.25
        for (let i = 0; i < out.length; i++) {
          const t = i / SAMPLE_RATE
          // Periods of 12, 8 and 6 s all divide 24 s, so the gusts loop cleanly.
          const gust =
            0.5 +
            0.3 * Math.sin((2 * Math.PI * t) / 12) +
            0.15 * Math.sin((2 * Math.PI * t) / 8 + 1) +
            0.05 * Math.sin((2 * Math.PI * t) / 6 + 2)
          const freq = 250 + 650 * gust
          const f = 2 * Math.sin((Math.PI * freq) / SAMPLE_RATE)
          const x = white(r)
          low += f * band
          const high = x - low - q * band
          band += f * high
          out[i] = band * (0.35 + 0.65 * gust)
        }
      },
      0.01
    ),
    0.6
  )
}

/** Fireplace: a low rumble with random crackles and the odd pop. */
export function fireplace(): Float32Array {
  return normalize(
    loopable(14, (out) => {
      const r = rng(7)
      const src = brownSource(r)
      const lp = lowpass()
      const c = cutoff(180)
      for (let i = 0; i < out.length; i++) out[i] = lp(src(), c) * 1.4
      const crackles = Math.round((out.length / SAMPLE_RATE) * 9)
      for (let n = 0; n < crackles; n++) {
        // Crackles come in little clusters.
        const center = Math.floor(r() * out.length)
        const count = 1 + Math.floor(r() * 4)
        for (let k = 0; k < count; k++) {
          const start = center + Math.floor(r() * 0.12 * SAMPLE_RATE)
          const amp = 0.15 + r() ** 2 * 0.6
          const decay = 0.0008 + r() * 0.003
          const len = Math.floor(decay * 8 * SAMPLE_RATE)
          const hp = lowpass()
          for (let j = 0; j < len && start + j < out.length; j++) {
            const x = white(r)
            const bright = x - hp(x, cutoff(1500))
            out[start + j] += bright * Math.exp(-j / SAMPLE_RATE / decay) * amp
          }
        }
      }
    }),
    0.6
  )
}

/** Warm, slow chords rendered offline: Cmaj9 – Am9 – Fmaj7 – G6, 8 s each. */
export async function lofiPad(): Promise<AudioBuffer> {
  const seconds = 32
  const fade = 0.5
  const ctx = new OfflineAudioContext(2, Math.round((seconds + fade) * SAMPLE_RATE), SAMPLE_RATE)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1100
  filter.Q.value = 0.4
  const out = ctx.createGain()
  out.gain.value = 0.18
  filter.connect(out).connect(ctx.destination)

  const chords = [
    [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
    [110.0, 164.81, 196.0, 246.94, 261.63], // Am9
    [87.31, 174.61, 220.0, 261.63, 329.63], // Fmaj7
    [98.0, 196.0, 246.94, 293.66, 329.63] // G6
  ]
  // k = -1 renders the last chord's tail at the very start so the loop has no gap.
  for (let k = -1; k < chords.length; k++) {
    const notes = chords[(k + chords.length) % chords.length]
    const start = k * 8 - 1.5
    const end = start + 11
    const level = (t: number): number =>
      t < start
        ? 0
        : t < start + 3
          ? (t - start) / 3
          : t < end - 3.5
            ? 1
            : Math.max(0, (end - t) / 3.5)
    const t0 = Math.max(0, start)
    for (const freq of notes) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq
        osc.detune.value = detune
        const g = ctx.createGain()
        g.gain.setValueAtTime(level(t0), t0)
        if (start + 3 > t0) g.gain.linearRampToValueAtTime(1, start + 3)
        if (end - 3.5 > t0) g.gain.setValueAtTime(1, end - 3.5)
        g.gain.linearRampToValueAtTime(0, end)
        osc.connect(g).connect(filter)
        osc.start(t0)
        osc.stop(end)
      }
    }
  }
  const rendered = await ctx.startRendering()

  // Oscillator phases differ at the joint, so cross-fade the overhang into the start.
  const n = seconds * SAMPLE_RATE
  const f = Math.round(fade * SAMPLE_RATE)
  const looped = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: SAMPLE_RATE })
  for (let ch = 0; ch < 2; ch++) {
    const raw = rendered.getChannelData(ch)
    const dest = looped.getChannelData(ch)
    dest.set(raw.subarray(0, n))
    for (let i = 0; i < f; i++) {
      const a = i / f
      dest[i] = raw[i] * Math.sin((a * Math.PI) / 2) + raw[n + i] * Math.cos((a * Math.PI) / 2)
    }
  }
  return looped
}
