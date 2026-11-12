import { AnimatePresence, motion } from 'framer-motion'
import type { TimerCommand, TimerState } from '../../../shared/types'
import { useT } from '../i18n'
import { EyeIcon, EyeOffIcon, PauseIcon, PlayIcon, ResetIcon, SkipIcon } from './icons'

interface Props {
  state: TimerState
  showClock: boolean
}

function send(cmd: TimerCommand): void {
  window.api.timer.command(cmd)
}

const SPRING = { type: 'spring', stiffness: 500, damping: 28 } as const

/**
 * One row, media-player style: small secondary actions on the outside
 * (hide clock, +1 minute), main actions in the middle.
 */
export function Controls({ state, showClock }: Props): React.JSX.Element {
  const t = useT()
  const running = state.status === 'running'
  const primary =
    state.status === 'running'
      ? { label: t('timer.pause'), cmd: 'pause' as const }
      : state.status === 'paused'
        ? { label: t('timer.resume'), cmd: 'resume' as const }
        : { label: t('timer.start'), cmd: 'start' as const }
  const clockLabel = showClock ? t('timer.hideClock') : t('timer.showClock')

  return (
    <div className="controls">
      <motion.button
        className={`ghost-btn${showClock ? '' : ' active'}`}
        onClick={() => window.api.settings.update({ showClock: !showClock })}
        title={clockLabel}
        aria-label={clockLabel}
        aria-pressed={!showClock}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
        transition={SPRING}
      >
        {showClock ? <EyeIcon width={18} height={18} /> : <EyeOffIcon width={18} height={18} />}
      </motion.button>

      <motion.button
        className="icon-btn"
        onClick={() => send('reset')}
        title={t('timer.resetHint')}
        aria-label={t('timer.reset')}
        whileHover={{ scale: 1.08, rotate: -30 }}
        whileTap={{ scale: 0.9, rotate: -90 }}
        transition={SPRING}
      >
        <ResetIcon />
      </motion.button>

      <motion.button
        className="play-btn"
        onClick={() => send(primary.cmd)}
        aria-label={primary.label}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        transition={SPRING}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={running ? 'pause' : 'play'}
            className="play-btn-icon"
            initial={{ scale: 0.4, opacity: 0, rotate: -45 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.2 }}
          >
            {running ? <PauseIcon width={30} height={30} /> : <PlayIcon width={30} height={30} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <motion.button
        className="icon-btn"
        onClick={() => send('skip')}
        title={t('timer.skipHint')}
        aria-label={t('timer.skip')}
        whileHover={{ scale: 1.08, x: 2 }}
        whileTap={{ scale: 0.9, x: 6 }}
        transition={SPRING}
      >
        <SkipIcon />
      </motion.button>

      <motion.button
        className="ghost-btn ghost-text"
        onClick={() => send('addMinute')}
        title={t('timer.addMinute')}
        aria-label={t('timer.addMinute')}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.88 }}
        transition={SPRING}
      >
        +1
      </motion.button>
    </div>
  )
}
