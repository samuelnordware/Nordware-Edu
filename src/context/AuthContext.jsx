import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, is_master')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data)
    // registra o ultimo acesso (painel de alunos), no maximo a cada 10 minutos
    try {
      const key = `nw-seen-${userId}`
      const last = Number(sessionStorage.getItem(key) || 0)
      if (data && Date.now() - last > 600000) {
        sessionStorage.setItem(key, String(Date.now()))
        supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then(() => {})
      }
    } catch {
      /* armazenamento indisponivel */
    }
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(next)
      // fora do callback para nao bloquear o cliente de auth
      setTimeout(() => loadProfile(next?.user?.id), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isManager: profile?.role === 'manager',
    // ADM Master: personaliza o site e concede esse acesso
    isMaster: Boolean(profile?.is_master),
    isTeacher: profile?.role === 'teacher',
    // professor ou gestor: pode publicar conteudo
    isStaff: profile?.role === 'manager' || profile?.role === 'teacher',
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, fullName) =>
      supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } }),
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }),
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => loadProfile(session?.user?.id),
    recovering,
    updatePassword: async (password) => {
      const res = await supabase.auth.updateUser({ password })
      if (!res.error) setRecovering(false)
      return res
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
