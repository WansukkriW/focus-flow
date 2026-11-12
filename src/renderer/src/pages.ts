import type { MessageKey } from '../../shared/i18n'
import { SettingsIcon, StatsIcon, TasksIcon } from './components/icons'

export type TabId = 'timer' | 'tasks' | 'stats' | 'settings'

/** The timer is the home screen; these are the pages you can open from the corner. */
export const PAGES: { id: Exclude<TabId, 'timer'>; label: MessageKey; Icon: typeof TasksIcon }[] = [
  { id: 'tasks', label: 'nav.tasks', Icon: TasksIcon },
  { id: 'stats', label: 'nav.stats', Icon: StatsIcon },
  { id: 'settings', label: 'nav.settings', Icon: SettingsIcon }
]
