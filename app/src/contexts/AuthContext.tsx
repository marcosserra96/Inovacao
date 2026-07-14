import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AdminRole } from '@/types/database.types'

interface AuthContextValue {
  session: Session | null
  role: AdminRole | null
  name: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<AdminRole | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadProfile(currentSession: Session | null) {
      if (!currentSession) {
        if (active) {
          setRole(null)
          setName(null)
        }
        return
      }
      const { data } = await supabase
        .from('admin_profiles')
        .select('role, name')
        .eq('user_id', currentSession.user.id)
        .maybeSingle()
      if (active) {
        setRole(data?.role ?? null)
        setName(data?.name ?? null)
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      loadProfile(newSession)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      role,
      name,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? traduzErroLogin(error.message) : null }
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }),
    [session, role, name, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function traduzErroLogin(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (message.includes('Email not confirmed')) return 'E-mail ainda não confirmado.'
  return 'Não foi possível entrar. Tente novamente.'
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
