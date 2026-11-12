const NAMED_KEYS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right'
}

/**
 * Turns a key press into an Electron accelerator such as "Control+Alt+P".
 * Uses `code`, so the result doesn't depend on the keyboard layout (Thai or English).
 */
export function acceleratorFromEvent(e: KeyboardEvent): {
  accelerator?: string
  error?: 'needModifier'
} {
  let key: string | undefined
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5)
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) key = e.code
  else if (/^Numpad[0-9]$/.test(e.code)) key = `num${e.code.slice(6)}`
  else key = NAMED_KEYS[e.code]
  if (!key) return {}

  const modifiers = [
    e.ctrlKey && 'Control',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && 'Super'
  ].filter(Boolean) as string[]
  // Bare letters would hijack normal typing everywhere; F-keys alone are fine.
  if (modifiers.length === 0 && !key.startsWith('F')) return { error: 'needModifier' }
  if (modifiers.length === 1 && modifiers[0] === 'Shift' && !key.startsWith('F')) {
    return { error: 'needModifier' }
  }
  return { accelerator: [...modifiers, key].join('+') }
}
