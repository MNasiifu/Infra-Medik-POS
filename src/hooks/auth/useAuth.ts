/**
 * useAuth
 *
 * Provides auth state reads and action callbacks (signIn, signOut, changePassword).
 *
 * The session bootstrap has been moved to useAuthBootstrap (called once in App.tsx).
 * This hook is now a pure store reader + action dispatcher — no side-effects, no
 * risk of tearing down the auth listener when a route transition unmounts a guard.
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase }      from '@/lib/supabase'
import { useAuthStore }  from '@/store/authStore'
import { queryClient }   from '@/lib/queryClient'
import { notify }        from '@/store/notificationStore'
import type { Profile }  from '@/types/database.types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export function useAuth() {
  const {
    session, user, profile,
    isLoading, isInitialized,
    setSession, setProfile, setLoading, clearAuth,
    isAuthenticated, mustChangePassword, role, branchId, fullName,
  } = useAuthStore()

  const navigate = useNavigate()

  // ── Actions ────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      const p = await fetchProfile(data.user.id)
      setSession(data.session, data.user)
      setProfile(p)
      return p
    } finally {
      setLoading(false)
    }
  }, [setLoading, setSession, setProfile])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      clearAuth()
      queryClient.clear()
      notify.info('You have been signed out.')
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Sign out error:', error)
      const msg = error instanceof Error ? error.message : 'Sign out failed'
      notify.error(msg)
    }
  }, [clearAuth, navigate])

  const changePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)

    const { error: profileError } = await db
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user!.id)

    if (profileError) throw new Error(profileError.message)

    setProfile({ ...profile!, must_change_password: false })
    notify.success('Password changed successfully.')
  }, [user, profile, setProfile])

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    session,
    user,
    profile,
    isLoading,
    isInitialized,
    isAuthenticated:    isAuthenticated(),
    mustChangePassword: mustChangePassword(),
    role:               role(),
    branchId:           branchId(),
    fullName:           fullName(),
    signIn,
    signOut,
    changePassword,
  }
}

// Convenience hook for components that just need to check auth state
export function useRequireAuth() {
  const navigate = useNavigate()
  const { isAuthenticated, isInitialized, mustChangePassword } = useAuth()

  // No useEffect needed — ProtectedRoute already handles the redirect.
  // This hook is kept for components that optionally want to know auth state.
  return { isAuthenticated, isInitialized, mustChangePassword, navigate }
}
