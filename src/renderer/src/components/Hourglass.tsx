import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { TimerState } from '../../../shared/types'
import { fractionLeft } from '../hooks'
import { adaptiveLoop, cappedFrameLoop, msPerHalfPixel } from '../ticker'

// Geometry in a 200×300 viewBox. The neck sits at y = 150.
const NECK_Y = 150
const TOP_FULL_Y = 40
const BOTTOM_Y = 272
const BOTTOM_MAX_RISE = 96

const GLASS_PATH =
  'M44,28 H156 C156,92 106,124 103,150 C106,176 156,208 156,272 H44 C44,208 94,176 97,150 C94,124 44,92 44,28 Z'

/** Top surface sits higher than a linear level because the wide part of the bulb holds most sand. */
function topSand(fraction: number, running: boolean): { path: string; edge: string } {
  const y = NECK_Y - (NECK_Y - TOP_FULL_Y) * Math.sqrt(fraction)
  const dip = running && fraction > 0 ? Math.min(5, (NECK_Y - y) * 0.4) : 0
  const surface = `L70,${y} Q100,${y + dip * 2} 130,${y}`
  return {
    path: `M0,${y} ${surface} L200,${y} L200,${NECK_Y} L0,${NECK_Y} Z`,
    edge: fraction > 0.01 ? `M30,${y} ${surface} L170,${y}` : ''
  }
}

/** A small heap grows quickly, then the level rises more slowly as the bulb widens. */
function bottomSand(fraction: number): { path: string; peakY: number } {
  const fallen = 1 - fraction
  const base = BOTTOM_Y - BOTTOM_MAX_RISE * fallen ** 1.3
  const peak = base - 14 * Math.min(1, fallen * 5)
  return {
    path: `M0,${base} L44,${base} C78,${base} 86,${peak} 100,${peak} C114,${peak} 122,${base} 156,${base} L200,${base} L200,280 L0,280 Z`,
    peakY: peak
  }
}

/** Falling grains: [phase offset 0..1, sideways drift, radius]. Fixed values keep it stable. */
const GRAINS: [number, number, number][] = [
  [0.0, -0.6, 1.2],
  [0.13, 0.8, 1.0],
  [0.27, -0.3, 1.3],
  [0.38, 1.1, 0.9],
  [0.52, -1.0, 1.1],
  [0.64, 0.4, 1.2],
  [0.77, -0.8, 1.0],
  [0.89, 0.6, 1.3]
]
/** Grains that bounce off the heap: [phase offset, direction]. */
const SPLASH: [number, number][] = [
  [0.1, -1],
  [0.35, 1],
  [0.6, -0.6],
  [0.85, 0.7]
]
const FALL_PERIOD_MS = 520
const SPLASH_PERIOD_MS = 700

/** Thin stream that tapers slightly and sways a fraction of a unit. */
function streamPath(peakY: number, now: number): string {
  const sway = Math.sin(now / 90) * 0.25
  return `M98.9,${NECK_Y} L101.1,${NECK_Y} L${100.6 + sway},${peakY} L${99.4 + sway},${peakY} Z`
}

function setPaths(group: SVGGElement | null, d: string): void {
  if (!group) return
  for (const path of group.children) path.setAttribute('d', d)
}

interface Props {
  state: TimerState
  /** Changes on every phase switch to trigger the flip. */
  flipKey: number
}

/** Fastest-moving sand edge, in viewBox units per ms, used to pace the redraws. */
function sandSpeed(fraction: number, durationMs: number): number {
  const top = (NECK_Y - TOP_FULL_Y) / (2 * Math.sqrt(Math.max(fraction, 0.01)))
  const fallen = 1 - fraction
  const bottom = BOTTOM_MAX_RISE * 1.3 * Math.pow(Math.max(fallen, 0.001), 0.3)
  const heap = fallen < 0.2 ? 14 * 5 : 0
  return Math.max(top, bottom, heap) / durationMs
}

/**
 * Hourglass countdown, drawn straight on the SVG nodes. The sand levels move slowly, so they
 * are redrawn only when an edge moves half a device pixel; only the falling grains run every
 * frame (capped at 60 fps), and they sit outside the glow filter so each frame stays cheap.
 * The glass flips over each time a new phase begins.
 */
export function Hourglass({ state, flipKey }: Props): React.JSX.Element {
  // Each sand group holds a colored path and a grain-texture copy drawn on top.
  const topRef = useRef<SVGGElement>(null)
  const topEdgeRef = useRef<SVGPathElement>(null)
  const bottomRef = useRef<SVGGElement>(null)
  const streamRef = useRef<SVGPathElement>(null)
  const grainsRef = useRef<SVGGElement>(null)
  /** Top of the bottom heap, shared from the sand loop with the grain loop. */
  const peakRef = useRef(BOTTOM_Y)

  const running = state.status === 'running'

  // Sand levels: redrawn only as fast as they visibly move.
  useEffect(() => {
    const draw = (): number | null => {
      const fraction = fractionLeft(state, Date.now())
      const bottom = bottomSand(fraction)
      const top = topSand(fraction, running)
      setPaths(topRef.current, top.path)
      topEdgeRef.current?.setAttribute('d', top.edge)
      setPaths(bottomRef.current, bottom.path)
      peakRef.current = bottom.peakY

      const pouring = running && fraction > 0
      const stream = streamRef.current
      if (stream) {
        stream.setAttribute('d', streamPath(bottom.peakY, 0))
        stream.style.opacity = pouring ? '1' : '0'
      }
      if (grainsRef.current) grainsRef.current.style.opacity = pouring ? '1' : '0'
      if (!pouring) return null

      const svg = topRef.current?.ownerSVGElement
      const unitPx = (svg ? svg.clientWidth / 200 : 1) * window.devicePixelRatio
      return msPerHalfPixel(sandSpeed(fraction, state.durationMs) * unitPx)
    }
    return adaptiveLoop(draw)
    // flipKey remounts the SVG, so the fresh nodes need drawing too.
  }, [state, flipKey, running])

  // Falling grains and the stream's sway: the only parts that need every frame.
  useEffect(() => {
    if (!running) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (document.documentElement.hasAttribute('data-reduce-motion')) return
    return cappedFrameLoop(60, (now) => {
      const peakY = peakRef.current
      streamRef.current?.setAttribute('d', streamPath(peakY, now))
      const grains = grainsRef.current
      if (!grains) return
      const fall = peakY - NECK_Y
      const nodes = grains.children
      GRAINS.forEach(([offset, drift, r], i) => {
        const p = (now / FALL_PERIOD_MS + offset) % 1
        const node = nodes[i] as SVGCircleElement
        // Accelerates like gravity and drifts a little away from the stream.
        node.setAttribute('cx', String(100 + drift * p * 1.6))
        node.setAttribute('cy', String(NECK_Y + fall * p * p))
        node.setAttribute('r', String(r))
        node.style.opacity = String(p > 0.85 ? (1 - p) / 0.15 : 1)
      })
      SPLASH.forEach(([offset, dir], i) => {
        const p = (now / SPLASH_PERIOD_MS + offset) % 1
        const node = nodes[GRAINS.length + i] as SVGCircleElement
        node.setAttribute('cx', String(100 + dir * 9 * p))
        node.setAttribute('cy', String(peakY - 5 * Math.sin(Math.PI * p) + 3 * p))
        node.setAttribute('r', '0.9')
        node.style.opacity = String(0.9 * (1 - p))
      })
    })
  }, [running, flipKey])

  return (
    <motion.div
      key={flipKey}
      className="hourglass"
      initial={flipKey === 0 ? false : { rotate: 180 }}
      animate={{ rotate: 0 }}
      transition={{ type: 'spring', stiffness: 70, damping: 14 }}
    >
      <svg viewBox="0 0 200 310" className="hourglass-svg" aria-hidden="true">
        <defs>
          <clipPath id="hg-glass">
            <path d={GLASS_PATH} />
          </clipPath>
          <linearGradient id="hg-sand-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--phase) 80%, white)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--phase) 85%, black)' }} />
          </linearGradient>
          <linearGradient id="hg-sand-bottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--phase) 85%, white)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--phase) 75%, black)' }} />
          </linearGradient>
          <pattern id="hg-grain" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="0.6" fill="#000" fillOpacity="0.18" />
            <circle cx="5" cy="4" r="0.5" fill="#fff" fillOpacity="0.22" />
            <circle cx="2.5" cy="5.8" r="0.45" fill="#000" fillOpacity="0.14" />
          </pattern>
          <radialGradient id="hg-glass-fill" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.015" />
          </radialGradient>
          <linearGradient id="hg-metal-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.07" />
          </linearGradient>
          <linearGradient id="hg-metal-h" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
          </linearGradient>
          <filter id="hg-shadow" x="-50%" y="-200%" width="200%" height="500%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        <ellipse
          cx="100"
          cy="300"
          rx="70"
          ry="5"
          fill="#000"
          fillOpacity="0.45"
          filter="url(#hg-shadow)"
        />

        {/* Back posts sit behind the glass. */}
        <rect x="31" y="24" width="6" height="252" rx="3" fill="url(#hg-metal-h)" />
        <rect x="163" y="24" width="6" height="252" rx="3" fill="url(#hg-metal-h)" />

        <path d={GLASS_PATH} fill="url(#hg-glass-fill)" />
        <g clipPath="url(#hg-glass)">
          {/* The glow filter only covers the slow-moving sand, never the per-frame grains. */}
          <g className="hourglass-sand">
            <g ref={topRef}>
              <path fill="url(#hg-sand-top)" />
              <path fill="url(#hg-grain)" />
            </g>
            <path ref={topEdgeRef} className="hourglass-sand-edge" />
            <g ref={bottomRef}>
              <path fill="url(#hg-sand-bottom)" />
              <path fill="url(#hg-grain)" />
            </g>
          </g>
        </g>
      </svg>

      {/*
       * The grains change every frame, so they get a layer of their own: redrawing them then
       * leaves the sand, gradients and glass below and above alone instead of repainting the
       * whole hourglass each frame. The three layers keep the original painting order.
       */}
      <svg
        viewBox="0 0 200 310"
        className="hourglass-svg hourglass-layer hourglass-grains-layer"
        aria-hidden="true"
      >
        <g clipPath="url(#hg-glass)">
          <path ref={streamRef} className="hourglass-stream" />
          <g ref={grainsRef} className="hourglass-grains">
            {[...GRAINS, ...SPLASH].map((_, i) => (
              <circle key={i} />
            ))}
          </g>
        </g>
      </svg>

      <svg viewBox="0 0 200 310" className="hourglass-svg hourglass-layer" aria-hidden="true">
        {/* Glass: a wide faint stroke for thickness, a crisp edge, and curved reflections. */}
        <path className="hourglass-glass-thick" d={GLASS_PATH} />
        <path className="hourglass-outline" d={GLASS_PATH} />
        <path className="hourglass-shine" d="M55,42 C57,76 74,102 90,122" />
        <path className="hourglass-shine-dot" d="M58,36 L60,48" />
        <path className="hourglass-shine" d="M55,262 C57,230 72,204 86,186" />
        <path className="hourglass-shine-faint" d="M145,44 C143,70 130,92 116,110" />

        {/* Front posts and caps. */}
        <rect x="26" y="10" width="148" height="18" rx="8" fill="url(#hg-metal-v)" />
        <rect x="26" y="10" width="148" height="18" rx="8" className="hourglass-cap-edge" />
        <rect x="26" y="272" width="148" height="18" rx="8" fill="url(#hg-metal-v)" />
        <rect x="26" y="272" width="148" height="18" rx="8" className="hourglass-cap-edge" />
        <rect x="36" y="13" width="128" height="2" rx="1" fill="#fff" fillOpacity="0.35" />
        <rect x="36" y="275" width="128" height="2" rx="1" fill="#fff" fillOpacity="0.3" />
      </svg>
    </motion.div>
  )
}
