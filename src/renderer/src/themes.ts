import {
  DEFAULT_SETTINGS,
  type ClockFont,
  type Phase,
  type Settings,
  type ThemeId
} from '../../shared/types'

export interface Theme {
  name: string
  bg: string
  /** Opaque card color; cards sit on top of the aurora at `surfaceAlpha`. */
  surface: string
  surfaceAlpha: number
  border: string
  text: string
  textMuted: string
  accent: string
  /** Two extra aurora blob colors; the third blob always follows the phase color. */
  aurora: [string, string]
}

export const THEMES: Record<ThemeId, Theme> = {
  midnight: {
    name: 'Midnight',
    bg: '#0b0d14',
    surface: '#151824',
    surfaceAlpha: 0.72,
    border: '#ffffff14',
    text: '#eef0f7',
    textMuted: '#a9b0c3',
    accent: '#7c9cff',
    aurora: ['#3046c9', '#6d28d9']
  },
  aurora: {
    name: 'Aurora',
    bg: '#071116',
    surface: '#0f1d23',
    surfaceAlpha: 0.72,
    border: '#ffffff14',
    text: '#eafaf6',
    textMuted: '#9fc2bb',
    accent: '#3ee0b9',
    aurora: ['#0f9f8f', '#7c3aed']
  },
  ocean: {
    name: 'Ocean',
    bg: '#06101f',
    surface: '#0e1b2e',
    surfaceAlpha: 0.72,
    border: '#ffffff14',
    text: '#eaf3ff',
    textMuted: '#9db3cf',
    accent: '#38bdf8',
    aurora: ['#0369a1', '#1d3fa8']
  },
  forest: {
    name: 'Forest',
    bg: '#08120d',
    surface: '#112018',
    surfaceAlpha: 0.72,
    border: '#ffffff14',
    text: '#ecf6ee',
    textMuted: '#a3bfaa',
    accent: '#8bd46a',
    aurora: ['#17703d', '#0f766e']
  },
  sunset: {
    name: 'Sunset',
    bg: '#140a10',
    surface: '#22121b',
    surfaceAlpha: 0.72,
    border: '#ffffff14',
    text: '#fff0f3',
    textMuted: '#cfa8b4',
    accent: '#ff9a5c',
    aurora: ['#b0185a', '#c2410c']
  }
}

/** Default phase colors; the user can change each one in Settings. */
export const PHASE_COLORS: Record<Phase, string> = DEFAULT_SETTINGS.phaseColors

export const PHASE_PRESETS = [
  '#ff6b81',
  '#ff9a5c',
  '#ffd166',
  '#8bd46a',
  '#4fd1b5',
  '#38bdf8',
  '#8b7cf6',
  '#c084fc'
]

export const CLOCK_FONT_OPTIONS: Record<
  ClockFont,
  { name: string; family: string; weight: number }
> = {
  outfit: { name: 'Outfit', family: "'Outfit Variable'", weight: 200 },
  sora: { name: 'Sora', family: "'Sora Variable'", weight: 250 },
  spaceGrotesk: { name: 'Space Grotesk', family: "'Space Grotesk Variable'", weight: 300 },
  jetbrainsMono: { name: 'JetBrains Mono', family: "'JetBrains Mono Variable'", weight: 250 }
}

export const ACCENT_PRESETS = [
  '#ff6b81',
  '#ff9a5c',
  '#ffd166',
  '#8bd46a',
  '#3ee0b9',
  '#38bdf8',
  '#7c9cff',
  '#c084fc'
]

/** Preferred dark text color for light backgrounds such as the big Start button. */
export const ON_PHASE_TEXT = '#0b0d14'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Picks dark or light text, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrast(bg, ON_PHASE_TEXT) >= contrast(bg, '#ffffff') ? ON_PHASE_TEXT : '#ffffff'
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function applyTheme(settings: Settings): void {
  const theme = THEMES[settings.theme]
  const accent = settings.accentColor ?? theme.accent
  const { focus, shortBreak, longBreak } = settings.phaseColors
  const font = CLOCK_FONT_OPTIONS[settings.clockFont]
  const vars: Record<string, string> = {
    '--bg': theme.bg,
    '--surface': withAlpha(theme.surface, theme.surfaceAlpha),
    '--surface-solid': theme.surface,
    '--border': theme.border,
    '--text': theme.text,
    '--text-muted': theme.textMuted,
    '--accent': accent,
    '--accent-soft': withAlpha(accent, 0.16),
    '--on-accent': readableOn(accent),
    '--aurora-a': theme.aurora[0],
    '--aurora-b': theme.aurora[1],
    '--focus': focus,
    '--short-break': shortBreak,
    '--long-break': longBreak,
    '--on-focus': readableOn(focus),
    '--on-short-break': readableOn(shortBreak),
    '--on-long-break': readableOn(longBreak),
    '--clock-font': `${font.family}, 'IBM Plex Sans Thai', sans-serif`,
    '--clock-weight': String(font.weight)
  }
  const root = document.documentElement.style
  for (const [key, value] of Object.entries(vars)) root.setProperty(key, value)
}
