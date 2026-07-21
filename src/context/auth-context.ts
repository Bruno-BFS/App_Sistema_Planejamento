import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  connectGoogleCalendar: () => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<boolean>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (name: string) => Promise<void>
  uploadProfileAvatar: (file: File) => Promise<string>
  removeProfileAvatar: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
