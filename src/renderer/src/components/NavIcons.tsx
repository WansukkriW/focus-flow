import { motion } from 'framer-motion'
import { useT } from '../i18n'
import { PAGES, type TabId } from '../pages'

/** Small icon buttons in the title bar. Clicking the open page again goes back to the timer. */
export function NavIcons({
  active,
  onSelect
}: {
  active: TabId
  onSelect: (tab: TabId) => void
}): React.JSX.Element {
  const t = useT()
  return (
    <nav className="nav-icons">
      {PAGES.map(({ id, label, Icon }) => {
        const selected = active === id
        return (
          <motion.button
            key={id}
            className={`nav-btn${selected ? ' active' : ''}`}
            aria-label={t(label)}
            aria-current={selected ? 'page' : undefined}
            title={t(label)}
            onClick={() => onSelect(selected ? 'timer' : id)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
          >
            <Icon width={17} height={17} />
          </motion.button>
        )
      })}
    </nav>
  )
}
