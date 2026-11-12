import type { Language } from '../types'
import { en } from './en'
import { th, type MessageKey } from './th'

export type { MessageKey }

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { th, en }

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

export function translator(language: Language): Translate {
  const dict = DICTIONARIES[language]
  return (key, vars) => {
    const text = dict[key]
    if (!vars) return text
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match
    )
  }
}
