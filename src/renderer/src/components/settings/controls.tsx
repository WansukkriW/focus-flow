import { motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { useT } from '../../i18n'
import { MinusIcon, PlusIcon } from '../icons'

export function Section({
  title,
  children
}: {
  title: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section className="card settings-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function Stepper({
  value,
  min,
  max,
  onCommit
}: {
  value: number
  min: number
  max: number
  onCommit: (value: number) => void
}): React.JSX.Element {
  const t = useT()
  // Keep a local draft so the field can be empty while typing.
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (n: number): void => onCommit(Math.min(max, Math.max(min, n)))
  return (
    <div className="stepper">
      <motion.button
        className="stepper-btn"
        aria-label={t('settings.decrease')}
        disabled={value <= min}
        onClick={() => commit(value - 1)}
        whileTap={{ scale: 0.85 }}
      >
        <MinusIcon />
      </motion.button>
      <input
        type="number"
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isInteger(n) && n >= min && n <= max) onCommit(n)
        }}
        onBlur={() => setDraft(null)}
      />
      <motion.button
        className="stepper-btn"
        aria-label={t('settings.increase')}
        disabled={value >= max}
        onClick={() => commit(value + 1)}
        whileTap={{ scale: 0.85 }}
      >
        <PlusIcon />
      </motion.button>
    </div>
  )
}

export function Switch({
  checked,
  label,
  hint,
  onChange
}: {
  checked: boolean
  label: string
  hint?: string
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="setting-row switch-row">
      <span className="setting-text">
        <span>{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="switch-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={`switch${checked ? ' on' : ''}`} aria-hidden="true">
        <motion.span
          className="switch-thumb"
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 32 }}
        />
      </span>
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}): React.JSX.Element {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? 'selected' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** 0..100 slider; the filled part of the track shows the level. */
export function Slider({
  value,
  label,
  onChange
}: {
  value: number
  label: string
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <input
      type="range"
      className="slider"
      min={0}
      max={100}
      step={1}
      value={value}
      aria-label={label}
      style={{ '--fill': `${value}%` } as React.CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}
