import { AnimatePresence, motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

/** One character slot; a changed digit slides down out while the new one slides in from above. */
function Digit({ char }: { char: string }): React.JSX.Element {
  return (
    <span className="digit-slot">
      <AnimatePresence initial={false}>
        <motion.span
          key={char}
          className="digit"
          initial={{ y: '-45%', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '45%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function AnimatedClock({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="clock" role="timer" aria-label={text}>
      {text.split('').map((char, i) =>
        char === ':' ? (
          <span key={i} className="clock-colon">
            :
          </span>
        ) : (
          <Digit key={i} char={char} />
        )
      )}
    </div>
  )
}
