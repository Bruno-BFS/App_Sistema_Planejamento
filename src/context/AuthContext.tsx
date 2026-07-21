import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { AuthContext, type AuthState } from './auth-context'
import { removeProfileAvatar as removeAvatar, uploadProfileAvatar as uploadAvatar } from '../services/profileAvatar'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') {
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
        window.location.replace(`${basePath}/login?mode=recovery`)
        return
      }
      if (nextSession && window.sessionStorage.getItem('meu-ritmo:calendar-connect-pending') === 'true') {
        window.sessionStorage.removeItem('meu-ritmo:calendar-connect-pending')
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
        window.location.replace(`${basePath}/integracoes?calendar=connected`)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    async signIn(email, password) {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signInWithGoogle() {
      if (!supabase) throw new Error('Supabase não configurado.')
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) throw error
    },
    async connectGoogleCalendar() {
      if (!supabase) throw new Error('Supabase não configurado.')
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
      window.sessionStorage.setItem('meu-ritmo:calendar-connect-pending', 'true')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          scopes: 'https://www.googleapis.com/auth/calendar.events',
          queryParams: { include_granted_scopes: 'true', prompt: 'consent' },
        },
      })
      if (error) {
        window.sessionStorage.removeItem('meu-ritmo:calendar-connect-pending')
        throw error
      }
    },
    async signUp(email, password, name) {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) throw error
      return Boolean(data.session)
    },
    async resetPassword(email) {
      if (!supabase) throw new Error('Supabase não configurado.')
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
      const redirectTo = `${window.location.origin}${basePath}/login?mode=recovery`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) throw error
    },
    async updatePassword(password) {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
    async updateProfile(name) {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error } = await supabase.auth.updateUser({ data: { name, full_name: name } })
      if (error) throw error
    },
    async uploadProfileAvatar(file) {
      if (!session?.user) throw new Error('Usuário não autenticado.')
      return uploadAvatar(session.user.id, file)
    },
    async removeProfileAvatar() {
      if (!session?.user) throw new Error('Usuário não autenticado.')
      await removeAvatar(session.user.id, session.user.user_metadata.picture ?? null)
    },
    async signOut() {
      if (!supabase) return
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  }), [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
