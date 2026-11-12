import { useEffect, useRef, type ReactNode } from 'react'
import type { TimerState } from '../../../shared/types'
import { fractionLeft } from '../hooks'
import { adaptiveLoop, msPerHalfPixel } from '../ticker'

const SIZE = 300
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2 - 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface Props {
  state: TimerState
  children?: ReactNode
}

/**
 * Countdown ring. While running it redraws straight on the SVG nodes (not through React
 * state), and only as often as the arc moves half a device pixel: about once a second for a
 * 25-minute focus, every frame for a 1-minute one, so it looks equally smooth either way.
 */
export function TimerRing({ state, children }: Props): React.JSX.Element {
  const arcRef = useRef<SVGCircleElement>(null)
  const knobRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const draw = (): void => {
      const fraction = fractionLeft(state, Date.now())
      const arc = arcRef.current
      const knob = knobRef.current
      if (!arc || !knob) return
      arc.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - fraction))
      // A round line cap would leave a dot behind at 0, so hide the arc entirely.
      arc.style.opacity = fraction > 0.001 ? '1' : '0'
      const angle = 2 * Math.PI * fraction
      knob.setAttribute('cx', String(SIZE / 2 + RADIUS * Math.cos(angle)))
      knob.setAttribute('cy', String(SIZE / 2 + RADIUS * Math.sin(angle)))
      knob.style.opacity = fraction > 0.001 ? '1' : '0'
    }

    if (state.status !== 'running') {
      draw()
      return
    }
    return adaptiveLoop(() => {
      draw()
      // On-screen length of the whole circle, in device pixels.
      const svg = arcRef.current?.ownerSVGElement
      const scale = svg ? svg.clientWidth / SIZE : 1
      const circlePx = CIRCUMFERENCE * scale * window.devicePixelRatio
      return msPerHalfPixel(circlePx / state.durationMs)
    })
  }, [state])

  return (
    <div className="ring">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="ring-svg">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            className="ring-track"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
          />
          <circle
            ref={arcRef}
            className="ring-arc"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
          />
          <circle ref={knobRef} className="ring-knob" r={STROKE * 0.85} />
        </g>
      </svg>
      <div className="ring-content">{children}</div>
    </div>
  )
}
