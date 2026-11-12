import { motion } from 'framer-motion'
import { ALARM_SOUNDS, AMBIENT_SOUNDS, type Settings } from '../../../../shared/types'
import { soundEngine } from '../../audio/engine'
import { useT } from '../../i18n'
import { CheckIcon, PlusIcon, SpeakerIcon, TrashIcon } from '../icons'
import { Section, Segmented, Slider } from './controls'

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

export function SoundSettings({ settings, onChange }: Props): React.JSX.Element {
  const t = useT()
  const customAmbient = settings.customSounds.filter((c) => c.kind === 'ambient')
  const customAlarm = settings.customSounds.filter((c) => c.kind === 'alarm')
  const ambientRows = [
    ...AMBIENT_SOUNDS.map((id) => ({ id, name: t(`sound.${id}`), file: undefined })),
    ...customAmbient.map((c) => ({ id: c.id, name: c.name, file: c.file }))
  ]
  const alarmOptions = [
    ...ALARM_SOUNDS.map((id) => ({
      id,
      name: t(`sound.${id}`),
      file: undefined as string | undefined
    })),
    ...customAlarm.map((c) => ({ id: c.id, name: c.name, file: c.file as string | undefined })),
    { id: 'none', name: t('sound.none'), file: undefined }
  ]

  const setVolume = (id: string, volume: number, file?: string): void => {
    onChange({ ambientVolumes: { ...settings.ambientVolumes, [id]: volume } })
    // Let the user hear the level they are setting, even when focus isn't running.
    if (volume > 0) soundEngine.previewAmbient(id, volume, file)
  }
  const previewAlarm = (id: string, file?: string): void => {
    void soundEngine.playAlarm(id, Math.max(settings.alarmVolume, 20), file)
  }

  return (
    <Section title={t('settings.sound')}>
      <div className="option-label">{t('sound.ambient')}</div>
      <div className="setting-row">
        <span className="setting-text">{t('sound.ambientMode')}</span>
        <Segmented
          label={t('sound.ambientMode')}
          value={settings.ambientMode}
          options={[
            { value: 'focus', label: t('sound.modeFocus') },
            { value: 'always', label: t('sound.modeAlways') }
          ]}
          onChange={(ambientMode) => onChange({ ambientMode })}
        />
      </div>
      {ambientRows.map(({ id, name, file }) => {
        const volume = settings.ambientVolumes[id] ?? 0
        return (
          <div key={id} className={`sound-row${volume > 0 ? ' on' : ''}`}>
            <button
              className="sound-play"
              aria-label={`${t('sound.preview')} ${name}`}
              title={t('sound.preview')}
              onClick={() => soundEngine.previewAmbient(id, volume || 50, file)}
            >
              <SpeakerIcon />
            </button>
            <span className="sound-name">{name}</span>
            <Slider
              value={volume}
              label={`${t('sound.volume')} ${name}`}
              onChange={(v) => setVolume(id, v, file)}
            />
            {file && (
              <button
                className="sound-remove"
                aria-label={t('sound.remove', { name })}
                title={t('sound.remove', { name })}
                onClick={() => window.api.sounds.remove(id)}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )
      })}

      <div className="option-label">{t('sound.alarm')}</div>
      <div className="alarm-grid" role="radiogroup" aria-label={t('sound.alarm')}>
        {alarmOptions.map(({ id, name, file }) => {
          const selected = settings.alarmSound === id
          return (
            <motion.button
              key={id}
              role="radio"
              aria-checked={selected}
              className={`option-card alarm-card${selected ? ' selected' : ''}`}
              onClick={() => {
                onChange({ alarmSound: id })
                previewAlarm(id, file)
              }}
              whileTap={{ scale: 0.96 }}
            >
              <span className="alarm-check">
                {selected && <CheckIcon width={12} height={12} />}
              </span>
              <span className="alarm-name">{name}</span>
              {file && (
                <span
                  role="button"
                  className="sound-remove"
                  aria-label={t('sound.remove', { name })}
                  title={t('sound.remove', { name })}
                  onClick={(e) => {
                    e.stopPropagation()
                    window.api.sounds.remove(id)
                  }}
                >
                  <TrashIcon width={13} height={13} />
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
      <div className="sound-row on">
        <button
          className="sound-play"
          aria-label={t('sound.preview')}
          title={t('sound.preview')}
          onClick={() =>
            previewAlarm(
              settings.alarmSound,
              customAlarm.find((c) => c.id === settings.alarmSound)?.file
            )
          }
        >
          <SpeakerIcon />
        </button>
        <span className="sound-name">{t('sound.volume')}</span>
        <Slider
          value={settings.alarmVolume}
          label={t('sound.volume')}
          onChange={(alarmVolume) => onChange({ alarmVolume })}
        />
      </div>

      <div className="option-label">
        {t('sound.custom')} <span className="setting-hint">· {t('sound.fileHint')}</span>
      </div>
      <div className="sound-add-row">
        <button className="pill-btn" onClick={() => window.api.sounds.add('ambient')}>
          <PlusIcon width={14} height={14} /> {t('sound.addAmbient')}
        </button>
        <button className="pill-btn" onClick={() => window.api.sounds.add('alarm')}>
          <PlusIcon width={14} height={14} /> {t('sound.addAlarm')}
        </button>
      </div>
    </Section>
  )
}
