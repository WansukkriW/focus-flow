import { Notification } from 'electron'
import { translator, type MessageKey } from '../shared/i18n'
import { phaseMinutes, type Phase, type Settings } from '../shared/types'
import type { PhaseEndEvent } from './timer'

const ENDED: Record<Phase, MessageKey> = {
  focus: 'notify.endedFocus',
  shortBreak: 'notify.endedShortBreak',
  longBreak: 'notify.endedLongBreak'
}

const active = new Set<Notification>()

export function notifyPhaseEnd(
  event: PhaseEndEvent,
  settings: Settings,
  onClick: () => void
): void {
  if (!settings.notifications || !Notification.isSupported()) return
  const t = translator(settings.language)
  const next = t('notify.next', {
    phase: t(`phase.${event.next}`),
    minutes: phaseMinutes(settings, event.next)
  })
  const notification = new Notification({
    title: t(ENDED[event.phase]),
    body: `${next} · ${event.autoStarted ? t('notify.started') : t('notify.pressStart')}`,
    // The app plays its own end-of-phase sound.
    silent: true
  })
  // Hold a reference until the toast is gone: if the object is garbage collected,
  // Windows dismisses the toast before it ever appears.
  active.add(notification)
  const release = (): void => {
    active.delete(notification)
  }
  notification.on('click', () => {
    release()
    onClick()
  })
  notification.on('close', release)
  notification.on('failed', (_e, error) => {
    console.error('Notification failed', error)
    release()
  })
  notification.show()
}
