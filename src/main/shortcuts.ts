import { globalShortcut } from 'electron'
import type { ShortcutStatus, Shortcuts } from '../shared/types'

type Actions = Record<keyof Shortcuts, () => void>

/** Registers the system-wide shortcuts and reports which ones could not be taken. */
export class GlobalShortcuts {
  private current: Shortcuts | null = null
  private suspended = false
  status: ShortcutStatus = { toggle: 'empty', skip: 'empty', mini: 'empty' }

  constructor(
    private readonly actions: Actions,
    private readonly onStatus: (status: ShortcutStatus) => void
  ) {}

  apply(shortcuts: Shortcuts): void {
    this.current = { ...shortcuts }
    if (!this.suspended) this.register()
  }

  /** While the user records a new shortcut, ours must not swallow the keys. */
  suspend(suspended: boolean): void {
    this.suspended = suspended
    if (suspended) globalShortcut.unregisterAll()
    else this.register()
  }

  dispose(): void {
    globalShortcut.unregisterAll()
  }

  private register(): void {
    globalShortcut.unregisterAll()
    if (!this.current) return
    const status = { ...this.status }
    const taken = new Set<string>()
    for (const key of Object.keys(this.actions) as (keyof Shortcuts)[]) {
      const accelerator = this.current[key]
      if (!accelerator) {
        status[key] = 'empty'
        continue
      }
      if (taken.has(accelerator.toLowerCase())) {
        status[key] = 'conflict'
        continue
      }
      try {
        // register() returns false when another program already owns the combination.
        const ok = globalShortcut.register(accelerator, this.actions[key])
        status[key] = ok ? 'ok' : 'conflict'
        if (ok) taken.add(accelerator.toLowerCase())
      } catch {
        status[key] = 'invalid'
      }
    }
    this.status = status
    this.onStatus(status)
  }
}
