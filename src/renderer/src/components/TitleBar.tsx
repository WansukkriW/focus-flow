import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { useT } from '../i18n'
import { ArrowLeftIcon, CloseIcon, MaximizeIcon, MinimizeIcon, RestoreIcon } from './icons'

interface Props {
  /** Icon buttons shown just before the window controls. */
  nav?: ReactNode
  /** On a page other than the timer: its name, shown as a back button. */
  back?: { label: string; onClick: () => void } | null
}

export function TitleBar({ nav, back }: Props): React.JSX.Element {
  const t = useT()
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizedChange(setMaximized)
  }, [])

  return (
    <header className="titlebar" onDoubleClick={() => window.api.window.toggleMaximize()}>
      <div className="titlebar-left">
        <span className="brand-mark" title="Focus Flow" aria-hidden="true" />
        <AnimatePresence initial={false}>
          {back && (
            <motion.button
              key={back.label}
              className="back-btn"
              onClick={back.onClick}
              onDoubleClick={(e) => e.stopPropagation()}
              title={t('nav.back')}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ArrowLeftIcon />
              {back.label}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <div className="titlebar-right" onDoubleClick={(e) => e.stopPropagation()}>
        {nav}
        <span className="titlebar-divider" aria-hidden="true" />
        <div className="titlebar-controls">
          <button
            className="titlebar-btn"
            aria-label={t('window.minimize')}
            onClick={() => window.api.window.minimize()}
          >
            <MinimizeIcon />
          </button>
          <button
            className="titlebar-btn"
            aria-label={maximized ? t('window.restore') : t('window.maximize')}
            onClick={() => window.api.window.toggleMaximize()}
          >
            {maximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            className="titlebar-btn titlebar-close"
            aria-label={t('window.close')}
            onClick={() => window.api.window.close()}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </header>
  )
}
