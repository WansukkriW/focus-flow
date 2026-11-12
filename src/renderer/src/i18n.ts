import { createContext, useContext, useMemo } from 'react'
import { translator, type Translate } from '../../shared/i18n'
import type { Language } from '../../shared/types'

export const LanguageContext = createContext<Language>('th')

/** Returns t(key, vars) for the current language; switching language re-renders instantly. */
export function useT(): Translate {
  const language = useContext(LanguageContext)
  return useMemo(() => translator(language), [language])
}
