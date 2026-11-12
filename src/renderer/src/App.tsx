import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { translator } from '../../shared/i18n'
import { Aurora } from './components/Aurora'
import { NavIcons } from './components/NavIcons'
import { SettingsPanel } from './components/SettingsPanel'
import { StatsPage } from './components/StatsPage'
import { TasksPage } from './components/TasksPage'
import { TimerView } from './components/TimerView'
import { TitleBar } from './components/TitleBar'
import {
  formatClock,
  useHistory,
  useRemainingMs,
  useSettings,
  useSounds,
  useTasks,
  useTimerState
} from './hooks'
import { LanguageContext } from './i18n'
import { PAGES, type TabId } from './pages'
import { applyTheme } from './themes'

function App(): React.JSX.Element {
  const state = useTimerState()
  const remainingMs = useRemainingMs(state)
  const [settings, updateSettings] = useSettings()
  const tasks = useTasks()
  const history = useHistory()
  const [tab, setTab] = useState<TabId>('timer')
  useSounds(state, settings)

  const language = settings?.language ?? 'th'
  const t = useMemo(() => translator(language), [language])

  const clock = formatClock(remainingMs)
  useEffect(() => {
    document.title = state ? `${clock} · ${t(`phase.${state.phase}`)} — Focus Flow` : 'Focus Flow'
  }, [clock, state, t])

  useEffect(() => {
    if (!settings) return
    applyTheme(settings)
    document.documentElement.toggleAttribute('data-reduce-motion', settings.reduceMotion)
    document.documentElement.lang = settings.language
  }, [settings])

  // Esc goes back to the timer from any other page.
  useEffect(() => {
    if (tab === 'timer') return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setTab('timer')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab])

  const ready = state && settings
  const page = PAGES.find((p) => p.id === tab)
  const activeTask = tasks.find((task) => task.id === settings?.activeTaskId) ?? null

  return (
    <LanguageContext.Provider value={language}>
      <MotionConfig reducedMotion={settings?.reduceMotion ? 'always' : 'user'}>
        <div className="app" data-phase={state?.phase ?? 'focus'}>
          <Aurora />
          <TitleBar
            nav={ready && <NavIcons active={tab} onSelect={setTab} />}
            back={page ? { label: t(page.label), onClick: () => setTab('timer') } : null}
          />
          {ready && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.main
                key={tab}
                className={`content content-${tab}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {tab === 'timer' && (
                  <TimerView
                    state={state}
                    settings={settings}
                    activeTask={activeTask}
                    onPickTask={() => setTab('tasks')}
                  />
                )}
                {tab === 'tasks' && <TasksPage tasks={tasks} settings={settings} />}
                {tab === 'stats' && (
                  <StatsPage history={history} tasks={tasks} settings={settings} />
                )}
                {tab === 'settings' && (
                  <SettingsPanel settings={settings} onChange={updateSettings} />
                )}
              </motion.main>
            </AnimatePresence>
          )}
        </div>
      </MotionConfig>
    </LanguageContext.Provider>
  )
}

export default App
