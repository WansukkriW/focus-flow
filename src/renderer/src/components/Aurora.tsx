import { useEffect, useRef } from 'react'
import { adaptiveLoop, msPerHalfPixel } from '../ticker'

/** Each blob drifts between two poses, easing in and out, then back (like CSS `alternate`). */
const DRIFTS = [
  { seconds: 26, from: [0, 0, 1], to: [18, 14, 1.15] },
  { seconds: 34, from: [0, 0, 1.1], to: [-22, -12, 0.95] },
  { seconds: 41, from: [0, 0, 0.9], to: [-16, 20, 1.1] }
] as const

/**
 * Blobs are drawn at a third of their visible size and scaled up 3×; they are soft
 * gradients, so the upscale looks identical but uses ~1/9 of the GPU memory.
 */
const UPSCALE = 3
/** Blob width in vmax before the upscale (matches `.aurora-blob`). */
const BLOB_VMAX = 30
/** The drift is so slow (well under a pixel per frame) that 20 updates a second look smooth. */
const FRAME_MS = 50
/** Longest gap between updates, so a blob leaving a turnaround never waits long to move. */
const MAX_WAIT_MS = 500

/** Offset in vmax and scale (before the upscale) of blob `i` at `t` ms. */
function pose(i: number, t: number): number[] {
  const { seconds, from, to } = DRIFTS[i]
  const cycle = (t / 1000 / seconds) % 2
  const linear = cycle < 1 ? cycle : 2 - cycle
  const p = (1 - Math.cos(Math.PI * linear)) / 2
  return from.map((f, k) => f + (to[k] - f) * p)
}

function toTransform([x, y, s]: number[]): string {
  return `translate3d(${x.toFixed(3)}vmax, ${y.toFixed(3)}vmax, 0) scale(${(s * UPSCALE).toFixed(4)})`
}

/** How far blob `i` moves over the next frame, in vmax, counting its edge as it grows. */
function stepVmax(i: number, t: number): number {
  const [x0, y0, s0] = pose(i, t)
  const [x1, y1, s1] = pose(i, t + FRAME_MS)
  return Math.hypot(x1 - x0, y1 - y0) + (Math.abs(s1 - s0) * BLOB_VMAX * UPSCALE) / 2
}

function reducedMotion(): boolean {
  return (
    document.documentElement.hasAttribute('data-reduce-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Slowly drifting gradient background. Moved from JS at a low frame rate instead of CSS
 * keyframes, which would recomposite the whole window at the display's full refresh rate.
 * Updates come at most 20 times a second and only once a blob has moved half a device pixel,
 * so the slow ends of each drift cost almost nothing; between updates nothing runs at all.
 */
export function Aurora(): React.JSX.Element {
  const blobs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const start = performance.now()
    return adaptiveLoop(() => {
      const reduced = reducedMotion()
      const t = reduced ? 0 : performance.now() - start
      blobs.current.forEach((el, i) => {
        if (el) el.style.transform = toTransform(pose(i, t))
      })
      // Still check now and then, in case reduced motion is switched off.
      if (reduced) return 1000
      const vmaxPx = (Math.max(window.innerWidth, window.innerHeight) / 100) * devicePixelRatio
      const step = Math.max(...DRIFTS.map((_, i) => stepVmax(i, t)))
      const wait = msPerHalfPixel((step * vmaxPx) / FRAME_MS)
      return Math.min(MAX_WAIT_MS, Math.max(FRAME_MS, wait))
    })
  }, [])

  return (
    <div className="aurora" aria-hidden="true">
      {['aurora-phase', 'aurora-a', 'aurora-b'].map((name, i) => (
        <div
          key={name}
          className={`aurora-blob ${name}`}
          ref={(el) => {
            blobs.current[i] = el
          }}
        />
      ))}
      <div className="aurora-vignette" />
    </div>
  )
}
