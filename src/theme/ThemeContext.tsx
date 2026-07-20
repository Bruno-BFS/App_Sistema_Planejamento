import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/useAuth'
import { getProfilePreferences, updateAppTheme } from '../services/planning'
import type { AppTheme, ProfilePreferences } from '../types/domain'
import { appThemeOptions, ThemeContext } from './theme-context'

const DEFAULT_THEME: AppTheme = 'olive'
const themeValues = new Set<AppTheme>(appThemeOptions.map((option) => option.value))

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && themeValues.has(value as AppTheme)
}

function storageKey(userId: string) {
  return `meu-ritmo:theme:${userId}`
}

function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme
  const themeColor = appThemeOptions.find((option) => option.value === theme)?.colors[0] ?? appThemeOptions[0].colors[0]
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
}

function readStoredTheme(userId: string) {
  try {
    const stored = window.localStorage.getItem(storageKey(userId))
    return isAppTheme(stored) ? stored : null
  } catch {
    return null
  }
}

function storeTheme(userId: string, theme: AppTheme) {
  try {
    window.localStorage.setItem(storageKey(userId), theme)
  } catch {
    // The database remains the source of truth when storage is unavailable.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME)
  const [saving, setSaving] = useState(false)
  const profileQuery = useQuery({
    queryKey: ['profile-preferences', user?.id],
    queryFn: () => getProfilePreferences(user!.id),
    enabled: Boolean(user),
  })

  useEffect(() => {
    const nextTheme = user ? readStoredTheme(user.id) ?? DEFAULT_THEME : DEFAULT_THEME
    setThemeState(nextTheme)
    applyTheme(nextTheme)
  }, [user])

  useEffect(() => {
    if (!user || !isAppTheme(profileQuery.data?.app_theme)) return
    setThemeState(profileQuery.data.app_theme)
    storeTheme(user.id, profileQuery.data.app_theme)
    applyTheme(profileQuery.data.app_theme)
  }, [profileQuery.data?.app_theme, user])

  const value = useMemo(() => ({
    theme,
    options: appThemeOptions,
    saving,
    async setTheme(nextTheme: AppTheme) {
      if (!user || nextTheme === theme) return
      const previousTheme = theme
      setSaving(true)
      setThemeState(nextTheme)
      storeTheme(user.id, nextTheme)
      applyTheme(nextTheme)
      try {
        await updateAppTheme(user.id, nextTheme)
        queryClient.setQueryData<ProfilePreferences>(['profile-preferences', user.id], (current) => current ? { ...current, app_theme: nextTheme } : current)
      } catch (error) {
        setThemeState(previousTheme)
        storeTheme(user.id, previousTheme)
        applyTheme(previousTheme)
        throw error
      } finally {
        setSaving(false)
      }
    },
  }), [queryClient, saving, theme, user])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
