import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { MessageKey } from '../../../shared/i18n'
import {
  CLOCK_FONTS,
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  THEME_IDS,
  TIMER_STYLES,
  type Phase,
  type Settings
} from '../../../shared/types'
import { useT } from '../i18n'
import { ACCENT_PRESETS, CLOCK_FONT_OPTIONS, PHASE_PRESETS, THEMES } from '../themes'
import { CheckIcon, PlusIcon } from './icons'
import { Section, Segmented, Stepper, Switch } from './settings/controls'
import { ShortcutSettings } from './settings/ShortcutSettings'
import { SoundSettings } from './settings/SoundSettings'

const PHASES: Phase[] = ['focus', 'shortBreak', 'longBreak']

type NumberKey = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakInterval'
type ToggleKey =
  | 'autoStartBreaks'
  | 'autoStartFocus'
  | 'notifications'
  | 'reduceMotion'
  | 'showClock'
  | 'closeToTray'
  | 'miniAutoOpen'

const NUMBER_FIELDS: { key: NumberKey; label: MessageKey; unit: MessageKey }[] = [
  { key: 'focusMinutes', label: 'settings.focus', unit: 'settings.minutes' },
  { key: 'shortBreakMinutes', label: 'settings.shortBreak', unit: 'settings.minutes' },
  { key: 'longBreakMinutes', label: 'settings.longBreak', unit: 'settings.minutes' },
  { key: 'longBreakInterval', label: 'settings.longBreakEvery', unit: 'settings.rounds' }
]

function RingPreview(): React.JSX.Element {
  return (
    <svg viewBox="0 0 60 60" className="style-preview" aria-hidden="true">
      <circle
        cx="30"
        cy="30"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="5"
      />
      <circle
        cx="30"
        cy="30"
        r="22"
        fill="none"
        stroke="var(--focus)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="138"
        strokeDashoffset="40"
        transform="rotate(-90 30 30)"
      />
    </svg>
  )
}

function HourglassPreview(): React.JSX.Element {
  return (
    <svg viewBox="0 0 60 60" className="style-preview" aria-hidden="true">
      <rect x="15" y="6" width="30" height="4" rx="2" fill="currentColor" fillOpacity="0.35" />
      <rect x="15" y="50" width="30" height="4" rx="2" fill="currentColor" fillOpacity="0.35" />
      <path
        d="M19,10 H41 C41,22 31,26 31,30 C31,34 41,38 41,50 H19 C19,38 29,34 29,30 C29,26 19,22 19,10 Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <path d="M24,19 H36 C34,23 31,25 30,28 C29,25 26,23 24,19 Z" fill="var(--focus)" />
      <path d="M21,49 C22,43 27,41 30,40 C33,41 38,43 39,49 Z" fill="var(--focus)" />
      <path d="M30,29 V40" stroke="var(--focus)" strokeWidth="1" />
    </svg>
  )
}

/** Two-step reset so a stray click doesn't wipe everything. */
function ResetAll({
  settings,
  onChange
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}): React.JSX.Element {
  const t = useT()
  const [stage, setStage] = useState<'idle' | 'confirm' | 'done'>('idle')
  useEffect(() => {
    if (stage === 'idle') return
    const id = window.setTimeout(() => setStage('idle'), 3000)
    return () => window.clearTimeout(id)
  }, [stage])
  return (
    <button
      className={`danger-btn${stage === 'confirm' ? ' confirm' : ''}`}
      onClick={() => {
        if (stage !== 'confirm') {
          setStage('confirm')
          return
        }
        // Keep the user's own data: sound files, the current task and the window spot.
        onChange({
          ...DEFAULT_SETTINGS,
          customSounds: settings.customSounds,
          activeTaskId: settings.activeTaskId,
          miniPosition: settings.miniPosition
        })
        setStage('done')
      }}
    >
      {stage === 'confirm'
        ? t('settings.resetConfirm')
        : stage === 'done'
          ? t('settings.resetDone')
          : t('settings.resetAll')}
    </button>
  )
}

export function SettingsPanel({
  settings,
  onChange
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}): React.JSX.Element {
  const t = useT()
  const toggle = (key: ToggleKey) => (checked: boolean) => onChange({ [key]: checked })
  const accent = settings.accentColor ?? THEMES[settings.theme].accent
  const setPhaseColor = (phase: Phase, color: string): void =>
    onChange({ phaseColors: { ...settings.phaseColors, [phase]: color } })

  return (
    <div className="settings">
      <Section title={t('settings.time')}>
        {NUMBER_FIELDS.map(({ key, label, unit }) => (
          <div key={key} className="setting-row">
            <span className="setting-text">{t(label)}</span>
            <Stepper
              value={settings[key]}
              {...SETTINGS_LIMITS[key]}
              onCommit={(value) => onChange({ [key]: value })}
            />
            <span className="setting-unit">{t(unit)}</span>
          </div>
        ))}
      </Section>

      <Section title={t('settings.auto')}>
        <Switch
          label={t('settings.autoBreaks')}
          checked={settings.autoStartBreaks}
          onChange={toggle('autoStartBreaks')}
        />
        <Switch
          label={t('settings.autoFocus')}
          checked={settings.autoStartFocus}
          onChange={toggle('autoStartFocus')}
        />
      </Section>

      <Section title={t('settings.timerLook')}>
        <div className="option-label">{t('settings.style')}</div>
        <div className="style-grid" role="radiogroup" aria-label={t('settings.style')}>
          {TIMER_STYLES.map((style) => {
            const selected = settings.timerStyle === style
            return (
              <motion.button
                key={style}
                role="radio"
                aria-checked={selected}
                className={`option-card${selected ? ' selected' : ''}`}
                onClick={() => onChange({ timerStyle: style })}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                {style === 'ring' ? <RingPreview /> : <HourglassPreview />}
                <span>{t(`settings.${style}`)}</span>
              </motion.button>
            )
          })}
        </div>

        <Switch
          label={t('settings.showClock')}
          hint={t('settings.showClockHint')}
          checked={settings.showClock}
          onChange={toggle('showClock')}
        />

        <div className="option-label">{t('settings.clockFont')}</div>
        <div className="font-grid" role="radiogroup" aria-label={t('settings.clockFont')}>
          {CLOCK_FONTS.map((font) => {
            const option = CLOCK_FONT_OPTIONS[font]
            const selected = settings.clockFont === font
            return (
              <motion.button
                key={font}
                role="radio"
                aria-checked={selected}
                className={`option-card font-card${selected ? ' selected' : ''}`}
                onClick={() => onChange({ clockFont: font })}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
              >
                <span
                  className="font-sample"
                  style={{ fontFamily: option.family, fontWeight: option.weight }}
                >
                  25:00
                </span>
                <span>{option.name}</span>
              </motion.button>
            )
          })}
        </div>

        <div className="option-label">{t('settings.phaseColors')}</div>
        {PHASES.map((phase) => (
          <div key={phase} className="phase-color-row">
            <span className="phase-color-name">{t(`phase.${phase}`)}</span>
            <div className="swatch-row">
              {PHASE_PRESETS.map((color) => {
                const selected = settings.phaseColors[phase] === color
                return (
                  <motion.button
                    key={color}
                    className={`swatch${selected ? ' selected' : ''}`}
                    style={{ background: color }}
                    aria-label={t('settings.colorOf', { phase: t(`phase.${phase}`), color })}
                    onClick={() => setPhaseColor(phase, color)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {selected && <CheckIcon width={12} height={12} />}
                  </motion.button>
                )
              })}
              <label
                className={`swatch swatch-custom${
                  PHASE_PRESETS.includes(settings.phaseColors[phase]) ? '' : ' selected'
                }`}
                title={t('settings.customColor')}
              >
                <input
                  type="color"
                  value={settings.phaseColors[phase]}
                  onChange={(e) => setPhaseColor(phase, e.target.value)}
                />
                <PlusIcon width={12} height={12} />
              </label>
            </div>
          </div>
        ))}
        <button
          className="text-btn"
          onClick={() => onChange({ phaseColors: { ...DEFAULT_SETTINGS.phaseColors } })}
        >
          {t('settings.resetColors')}
        </button>
      </Section>

      <Section title={t('settings.theme')}>
        <div className="theme-grid" role="radiogroup" aria-label={t('settings.theme')}>
          {THEME_IDS.map((id) => {
            const theme = THEMES[id]
            const selected = settings.theme === id
            return (
              <motion.button
                key={id}
                role="radio"
                aria-checked={selected}
                className={`theme-swatch${selected ? ' selected' : ''}`}
                onClick={() => onChange({ theme: id })}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <span
                  className="theme-preview"
                  style={{
                    background: `radial-gradient(circle at 25% 30%, ${theme.aurora[0]}, transparent 65%),
                      radial-gradient(circle at 80% 75%, ${theme.aurora[1]}, transparent 60%), ${theme.bg}`
                  }}
                >
                  <span className="theme-preview-dot" style={{ background: theme.accent }} />
                </span>
                <span className="theme-name">{theme.name}</span>
              </motion.button>
            )
          })}
        </div>

        <div className="accent-label">{t('settings.accent')}</div>
        <div className="accent-row">
          <button
            className={`accent-auto${settings.accentColor === null ? ' selected' : ''}`}
            onClick={() => onChange({ accentColor: null })}
          >
            {t('settings.accentAuto')}
          </button>
          {ACCENT_PRESETS.map((color) => (
            <motion.button
              key={color}
              className={`accent-swatch${settings.accentColor === color ? ' selected' : ''}`}
              style={{ background: color }}
              aria-label={`${t('settings.accent')} ${color}`}
              onClick={() => onChange({ accentColor: color })}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              {settings.accentColor === color && <CheckIcon />}
            </motion.button>
          ))}
          <label className="accent-custom" title={t('settings.customColor')}>
            <input
              type="color"
              value={accent}
              onChange={(e) => onChange({ accentColor: e.target.value })}
            />
            <PlusIcon />
          </label>
        </div>
      </Section>

      <SoundSettings settings={settings} onChange={onChange} />
      <ShortcutSettings settings={settings} onChange={onChange} />

      <Section title={t('settings.general')}>
        <div className="setting-row">
          <span className="setting-text">{t('settings.language')}</span>
          <Segmented
            label={t('settings.language')}
            value={settings.language}
            options={[
              { value: 'th', label: 'ไทย' },
              { value: 'en', label: 'English' }
            ]}
            onChange={(language) => onChange({ language })}
          />
        </div>
        <div className="setting-row">
          <span className="setting-text">{t('settings.dailyGoal')}</span>
          <Stepper
            value={settings.dailyGoal}
            {...SETTINGS_LIMITS.dailyGoal}
            onCommit={(dailyGoal) => onChange({ dailyGoal })}
          />
          <span className="setting-unit">{t('settings.rounds')}</span>
        </div>
        <Switch
          label={t('settings.notifications')}
          checked={settings.notifications}
          onChange={toggle('notifications')}
        />
        <Switch
          label={t('settings.closeToTray')}
          hint={t('settings.closeToTrayHint')}
          checked={settings.closeToTray}
          onChange={toggle('closeToTray')}
        />
        <Switch
          label={t('settings.miniAutoOpen')}
          checked={settings.miniAutoOpen}
          onChange={toggle('miniAutoOpen')}
        />
        <Switch
          label={t('settings.reduceMotion')}
          hint={t('settings.reduceMotionHint')}
          checked={settings.reduceMotion}
          onChange={toggle('reduceMotion')}
        />
        <div className="setting-row">
          <ResetAll settings={settings} onChange={onChange} />
        </div>
      </Section>
    </div>
  )
}
