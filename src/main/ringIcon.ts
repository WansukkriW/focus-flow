/** Parses #rrggbb. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export interface RingOptions {
  size: number
  color: string
  /** Share of the ring drawn in color, starting at 12 o'clock and going clockwise. */
  fraction: number
  /** Color and opacity of the rest of the ring. */
  trackColor?: string
  trackAlpha?: number
  /** Ring radius and thickness relative to the icon size. */
  radius?: number
  thickness?: number
  /** Optional filled disc behind the ring (for the app icon). */
  background?: string
}

/**
 * Draws an anti-aliased progress ring into straight RGBA pixels. Used for the tray icon,
 * which changes color and fills as time passes, and for the app icon.
 */
export function drawRing({
  size,
  color,
  fraction,
  trackColor = '#ffffff',
  trackAlpha = 0.35,
  radius = 0.36,
  thickness = 0.16,
  background
}: RingOptions): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const center = size / 2
  const r = size * radius
  const half = (size * thickness) / 2
  const arc = rgb(color)
  const track = rgb(trackColor)
  const bg = background ? rgb(background) : null
  const bgRadius = size / 2 - 0.5

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - center
      const dy = y + 0.5 - center
      const d = Math.hypot(dx, dy)
      // Coverage falls off over one pixel at each edge for smooth anti-aliasing.
      const ring = Math.max(0, Math.min(1, half - Math.abs(d - r) + 0.5))
      let angle = Math.atan2(dx, -dy) / (2 * Math.PI)
      if (angle < 0) angle += 1
      const inArc = angle <= fraction

      let [cr, cg, cb, ca] = [0, 0, 0, 0]
      if (bg) {
        const cover = Math.max(0, Math.min(1, bgRadius - d + 0.5))
        ;[cr, cg, cb, ca] = [bg[0], bg[1], bg[2], cover]
      }
      if (ring > 0) {
        const [sr, sg, sb] = inArc ? arc : track
        const sa = ring * (inArc ? 1 : trackAlpha)
        // Source-over blend onto whatever is underneath.
        const outA = sa + ca * (1 - sa)
        if (outA > 0) {
          cr = (sr * sa + cr * ca * (1 - sa)) / outA
          cg = (sg * sa + cg * ca * (1 - sa)) / outA
          cb = (sb * sa + cb * ca * (1 - sa)) / outA
        }
        ca = outA
      }
      const i = (y * size + x) * 4
      out[i] = Math.round(cr)
      out[i + 1] = Math.round(cg)
      out[i + 2] = Math.round(cb)
      out[i + 3] = Math.round(ca * 255)
    }
  }
  return out
}
