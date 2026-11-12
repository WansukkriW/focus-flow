import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { Phase, Settings, Task, TimerState } from '../../../shared/types'
import { formatClock, useRemainingMs } from '../hooks'
import { useT } from '../i18n'
import { AnimatedClock } from './AnimatedClock'
import { Controls } from './Controls'
import { Hourglass } from './Hourglass'
import { TimerRing } from './TimerRing'

interface Props {
  state: TimerState
  settings: Settings
  activeTask: Task | null
  onPickTask: () => void
}

/** The task being worked on, with its round count; opens the task list when clicked. */
function ActiveTask({
  task,
  onClick
}: {
  task: Task | null
  onClick: () => void
}): React.JSX.Element {
  const t = useT()
  return (
    <button className={`active-task${task ? '' : ' empty'}`} onClick={onClick}>
      {task ? (
        <>
          <span className="active-task-count">
            🍅{' '}
            {t('tasks.pomodoros', {
              done: task.completedPomodoros,
              estimate: task.estimatedPomodoros
            })}
          </span>
          <span className="active-task-title">{task.title}</span>
        </>
      ) : (
        <span>+ {t('timer.pickTask')}</span>
      )}
    </button>
  )
}

/** Counts phase changes so each one fires a fresh pulse animation. */
function usePhaseChangeCount(phase: Phase): number {
  const previous = useRef(phase)
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (previous.current !== phase) {
      previous.current = phase
      setCount((c) => c + 1)
    }
  }, [phase])
  return count
}

function RoundDots({ state, total }: { state: TimerState; total: number }): React.JSX.Element {
  const t = useT()
  return (
    <div className="round-dots" aria-label={t('timer.roundsDone', { done: state.cycle, total })}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < state.cycle
        const current = state.phase === 'focus' && i === state.cycle
        return (
          <motion.span
            key={i}
            className={`round-dot${done ? ' done' : ''}${current ? ' current' : ''}`}
            initial={false}
            animate={{ scale: current ? 1.25 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          />
        )
      })}
    </div>
  )
}

/** Phase name as quiet text with a colored dot; it also carries the paused state. */
function PhaseLabel({
  state,
  large = false
}: {
  state: TimerState
  large?: boolean
}): React.JSX.Element {
  const t = useT()
  const paused = state.status === 'paused'
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={state.phase + (paused ? '-paused' : '')}
        className={`phase-label${paused ? ' paused' : ''}${large ? ' large' : ''}`}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.2 }}
      >
        <span className="phase-label-dot" />
        {t(`phase.${state.phase}`)}
        {paused && <span className="phase-label-paused">· {t('status.paused')}</span>}
      </motion.div>
    </AnimatePresence>
  )
}

const FADE = {
  initial: { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.92, filter: 'blur(8px)' },
  transition: { duration: 0.3 }
}

export function TimerView({ state, settings, activeTask, onPickTask }: Props): React.JSX.Element {
  const remainingMs = useRemainingMs(state)
  const phaseChanges = usePhaseChangeCount(state.phase)
  const osReducedMotion = useReducedMotion()
  const showPulse = phaseChanges > 0 && !settings.reduceMotion && !osReducedMotion
  const { showClock } = settings
  const clock = <AnimatedClock text={formatClock(remainingMs)} />
  const dots = <RoundDots state={state} total={settings.longBreakInterval} />

  return (
    <div className={`timer-view timer-${settings.timerStyle}${showClock ? '' : ' clock-hidden'}`}>
      {settings.timerStyle === 'ring' ? (
        <div className="ring-wrap">
          {showPulse && (
            <div className="pulse-layer" key={phaseChanges} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="pulse-ring"
                  initial={{ scale: 0.75, opacity: 0.55 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  transition={{ duration: 1.6, delay: i * 0.25, ease: 'easeOut' }}
                />
              ))}
            </div>
          )}
          <TimerRing state={state}>
            {/* With the clock hidden, the phase name moves to the middle instead. */}
            <AnimatePresence initial={false}>
              {showClock && (
                <motion.div key="top" className="ring-slot ring-top" {...FADE}>
                  <PhaseLabel state={state} />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="ring-slot ring-center">
              <AnimatePresence initial={false} mode="wait">
                <motion.div key={showClock ? 'clock' : 'label'} {...FADE}>
                  {showClock ? clock : <PhaseLabel state={state} large />}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="ring-slot ring-bottom">{dots}</div>
          </TimerRing>
        </div>
      ) : (
        <>
          <Hourglass state={state} flipKey={phaseChanges} />
          <div className="hourglass-info">
            {/* Stays mounted and collapses in CSS, in step with the hourglass growing. */}
            <div className="clock-collapse" aria-hidden={!showClock}>
              <div className="clock-collapse-inner">{clock}</div>
            </div>
            <div className="hourglass-meta">
              <PhaseLabel state={state} />
              {dots}
            </div>
          </div>
        </>
      )}

      <ActiveTask task={activeTask} onClick={onPickTask} />
      <Controls state={state} showClock={showClock} />
    </div>
  )
}
