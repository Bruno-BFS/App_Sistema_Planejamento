import { createContext } from 'react'
import type { AppTheme } from '../types/domain'

export const appThemeOptions: ReadonlyArray<{
  value: AppTheme
  label: string
  description: string
  colors: readonly [string, string, string]
}> = [
  { value: 'olive', label: 'Oliva', description: 'Natural e acolhedor', colors: ['#30362c', '#65704f', '#dce9b8'] },
  { value: 'rose', label: 'Rosa', description: 'Suave e contemporâneo', colors: ['#51363e', '#a85f78', '#f2ceda'] },
  { value: 'charcoal', label: 'Cinza escuro', description: 'Sóbrio e minimalista', colors: ['#222629', '#4d555a', '#cfd4d7'] },
  { value: 'blue', label: 'Azul', description: 'Calmo e concentrado', colors: ['#243849', '#47779b', '#c9e0f1'] },
]

export interface ThemeState {
  theme: AppTheme
  options: typeof appThemeOptions
  saving: boolean
  setTheme: (theme: AppTheme) => Promise<void>
}

export const ThemeContext = createContext<ThemeState | null>(null)
