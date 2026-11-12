import { MotionConfig } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { CloseIcon, PauseIcon, PlayIcon } from './components/icons'
import { TimerRing } from './components/TimerRing'
import { formatClock, useRemainingMs, useSettings, useTasks, useTimerState } from './hooks'
import { LanguageContext, useT } from './i18n'
import { applyTheme } from './themes'
import type { Settings, Task, TimerState } from '../../shared/types'

/**
 * Moves the frameless window by hand instead of with a CSS drag region, because a drag region
 * swallows double-clicks (which open the main window).
 */
function useWindowDrag(): (e: React.PointerEvent<HTMLDivElement>) => void {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  return (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    // Only pointer screen positions are sent; window.screenX is unreliable in a frameless
    // transparent window, so the main process tracks where the window started.
    drag.current = { x: e.screenX, y: e.screenY, moved: false }
    let frame = 0
    const move = (ev: PointerEvent): void => {
      const d = drag.current
      if (!d) return
      if (!d.moved) {
        // A few pixels of slack so a double-click never nudges the window.
        if (Math.hypot(ev.screenX - d.x, ev.screenY - d.y) < 4) return
        d.moved = true
        window.api.mini.dragStart(d.x, d.y)
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => window.api.mini.dragMove(ev.screenX, ev.screenY))
    }
    const up = (): void => {
      drag.current = null
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
}

function Mini({
  state,
  settings,
  task
}: {
  state: TimerState
  settings: Settings
  task: Task | null
}): React.JSX.Element {
  const t = useT()
  const remaining = useRemainingMs(state)
  const startDrag = useWindowDrag()
  const running = state.status === 'running'
  const primary = running ? 'pause' : state.status === 'paused' ? 'resume' : 'start'

  return (
    <div
      className="mini"
      data-phase={state.phase}
      title={t('mini.openMain')}
      onPointerDown={startDrag}
      onDoubleClick={() => window.api.mini.showMain()}
    >
      <div className="mini-ring">
        <TimerRing state={state} />
      </div>
      <div className="mini-info">
        <div className="mini-time" style={{ fontFamily: 'var(--clock-font)' }}>
          {settings.showClock ? formatClock(remaining) : t(`phase.${state.phase}`)}
        </div>
        <div className="mini-sub">
          {task ? task.title : settings.showClock ? t(`phase.${state.phase}`) : ''}
        </div>
      </div>
      <button
        className="mini-play"
        aria-label={t(`timer.${primary}`)}
        title={t(`timer.${primary}`)}
        onClick={() => window.api.timer.command(primary)}
      >
        {running ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
      </button>
      <button
        className="mini-close"
        aria-label={t('mini.close')}
        title={t('mini.close')}
        onClick={() => window.api.mini.toggle()}
      >
        <CloseIcon width={10} height={10} />
      </button>
    </div>
  )
}

export default function MiniApp(): React.JSX.Element | null {
  const state = useTimerState()
  const [settings] = useSettings()
  const tasks = useTasks()

  useEffect(() => {
    document.documentElement.classList.add('mini-root')
  }, [])
  useEffect(() => {
    if (settings) applyTheme(settings)
  }, [settings])

  if (!state || !settings) return null
  const task = tasks.find((t) => t.id === settings.activeTaskId) ?? null
  return (
    <LanguageContext.Provider value={settings.language}>
      <MotionConfig reducedMotion={settings.reduceMotion ? 'always' : 'user'}>
        <Mini state={state} settings={settings} task={task} />
      </MotionConfig>
    </LanguageContext.Provider>
  )
}
