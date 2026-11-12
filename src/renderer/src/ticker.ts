/**
 * Redraw scheduling for slow-moving graphics. A 25-minute ring moves about half a pixel per
 * second, so redrawing it every display frame (144 Hz here) wastes CPU and GPU for no visible
 * change. These helpers redraw only as often as the picture actually moves.
 */

/** Smallest movement worth a redraw, in device pixels. */
const STEP_PX = 0.5
const MIN_MS = 16
const MAX_MS = 1000
/** Getting a frame after an idle spell takes a frame or so, so timers fire this much early. */
const FRAME_LEAD_MS = 8

/** How long until something moving `pxPerMs` has travelled half a device pixel. */
export function msPerHalfPixel(pxPerMs: number): number {
  if (!(pxPerMs > 0)) return MAX_MS
  return Math.min(MAX_MS, Math.max(MIN_MS, STEP_PX / pxPerMs))
}

/**
 * Calls `draw` now and again after however many ms it returns; returning null stops.
 * Short waits use animation frames, long ones a timer that then waits for the next frame, so
 * every draw lines up with the display and nothing runs while the window is hidden.
 */
export function adaptiveLoop(draw: () => number | null): () => void {
  let timer = 0
  let frame = 0
  let stopped = false
  const run = (): void => {
    if (stopped) return
    const wait = draw()
    if (wait === null) return
    if (wait <= 20) frame = requestAnimationFrame(run)
    else timer = window.setTimeout(() => (frame = requestAnimationFrame(run)), wait - FRAME_LEAD_MS)
  }
  run()
  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    window.clearTimeout(timer)
  }
}

/**
 * Runs `draw(now)` on animation frames, at most `fps` times a second. Merely asking for every
 * frame makes Chromium wake up for each one (144 a second here), so between draws the loop
 * sleeps on a timer and asks for a frame only during the one before the frame it will draw on.
 * Timers turn coarse on battery power; while they fire late it checks every frame instead,
 * so the draws keep exactly the same pace either way.
 */
export function cappedFrameLoop(fps: number, draw: (now: number) => void): () => void {
  const minGap = 1000 / fps - 2
  let last = 0
  /** Time of the previous frame, kept only when it asked for this very next frame. */
  let prev = 0
  /** Display frame length, learned from back-to-back frames; relearned if a wake misses. */
  let frameMs = Infinity
  /** The frame the timer aims for. */
  let target = 0
  /** Draws left to make frame by frame after a late timer, before trying timers again. */
  let pollDraws = 0
  let frame = 0
  let timer = 0

  const nextFrame = (now: number): void => {
    prev = now
    frame = requestAnimationFrame(loop)
  }
  const loop = (now: number): void => {
    if (prev > 0) frameMs = Math.min(frameMs, now - prev)
    prev = 0
    // Woke a frame or more past the aim: the display changed, so learn its pace again.
    if (target > 0 && now > target + frameMs / 2) frameMs = Infinity
    target = 0
    if (now - last < minGap) return nextFrame(now)
    last = now
    draw(now)

    // The first frame at least `minGap` after this one. Asking for a frame any time during the
    // one before it lands on it, so wake early in that span to leave room for a late timer.
    const aim = last + Math.ceil(minGap / frameMs) * frameMs
    const wake = aim - frameMs * 0.6
    const sleep = wake - performance.now()
    if (pollDraws > 0 || !(sleep >= frameMs)) {
      pollDraws = Math.max(0, pollDraws - 1)
      return nextFrame(now)
    }
    timer = window.setTimeout(() => {
      // Half a frame late leaves little margin, so check every frame for a while.
      if (performance.now() - wake > frameMs / 2) pollDraws = fps
      target = aim
      frame = requestAnimationFrame(loop)
    }, sleep)
  }
  frame = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(frame)
    window.clearTimeout(timer)
  }
}
