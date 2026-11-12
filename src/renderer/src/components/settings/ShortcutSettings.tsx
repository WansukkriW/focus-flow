import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, type Settings, type Shortcuts } from '../../../../shared/types'
import { useShortcutStatus } from '../../hooks'
import { useT } from '../../i18n'
import { acceleratorFromEvent } from '../../shortcutKeys'
import { Section } from './controls'

function pretty(accelerator: string): string {
  return accelerator.replace(/Control/g, 'Ctrl').replace(/\+/g, ' + ')
}

function ShortcutField({
  value,
  onChange
}: {
  value: string
  onChange: (accelerator: string) => void
}): React.JSX.Element {
  const t = useT()
  const [recording, setRecording] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  // Read through a ref so a new onChange each render doesn't restart the recording.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!recording) return
    window.api.shortcuts.suspend(true)
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(false)
        return
      }
      const { accelerator, error } = acceleratorFromEvent(e)
      if (error) setHint(t('shortcuts.needModifier'))
      if (accelerator) {
        onChangeRef.current(accelerator)
        setRecording(false)
      }
    }
    // Capture phase, so Esc here doesn't also close the Settings page.
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.api.shortcuts.suspend(false)
      setHint(null)
    }
  }, [recording, t])

  return (
    <div className="shortcut-field">
      <button
        className={`shortcut-keys${recording ? ' recording' : ''}`}
        title={t('shortcuts.clickToChange')}
        onClick={() => setRecording((r) => !r)}
        onBlur={() => setRecording(false)}
      >
        {recording ? t('shortcuts.recording') : value ? pretty(value) : t('shortcuts.none')}
      </button>
      {hint && <span className="shortcut-error">{hint}</span>}
    </div>
  )
}

export function ShortcutSettings({
  settings,
  onChange
}: {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}): React.JSX.Element {
  const t = useT()
  const status = useShortcutStatus()
  const rows: { key: keyof Shortcuts; label: string }[] = [
    { key: 'toggle', label: t('shortcuts.toggle') },
    { key: 'skip', label: t('shortcuts.skip') },
    { key: 'mini', label: t('shortcuts.mini') }
  ]
  const set = (key: keyof Shortcuts, accelerator: string): void =>
    onChange({ shortcuts: { ...settings.shortcuts, [key]: accelerator } })

  return (
    <Section title={t('settings.shortcuts')}>
      {rows.map(({ key, label }) => {
        const state = status?.[key]
        return (
          <div key={key} className="setting-row shortcut-row">
            <span className="setting-text">
              <span>{label}</span>
              {state === 'conflict' && (
                <span className="shortcut-error">{t('shortcuts.conflict')}</span>
              )}
              {state === 'invalid' && (
                <span className="shortcut-error">{t('shortcuts.invalid')}</span>
              )}
            </span>
            <ShortcutField value={settings.shortcuts[key]} onChange={(a) => set(key, a)} />
            {settings.shortcuts[key] && (
              <button className="text-btn muted" onClick={() => set(key, '')}>
                {t('shortcuts.clear')}
              </button>
            )}
          </div>
        )
      })}
      <button
        className="text-btn"
        onClick={() => onChange({ shortcuts: { ...DEFAULT_SETTINGS.shortcuts } })}
      >
        {t('shortcuts.reset')}
      </button>
    </Section>
  )
}
