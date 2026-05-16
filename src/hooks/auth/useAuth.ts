import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any
import { queryClient } from '@/lib/queryClient'
import { notify } from '@/store/notificationStore'
import type { Profile } from '@/types/database.types'

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
    setSession, setProfile, setLoading, setInitialized, clearAuth,
    isAuthenticated, mustChangePassword, role, branchId, fullName,
  } = useAuthStore()

  // Bootstrap: check existing session on mount
  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (session && mounted) {
        const p = await fetchProfile(session.user.id)
        setSession(session, session.user)
        setProfile(p)
      }

      if (mounted) {
        setLoading(false)
        setInitialized(true)
      }
    }

    init()

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session) {
          setLoading(true)
          const p = await fetchProfile(session.user.id)
          setSession(session, session.user)
          setProfile(p)
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          clearAuth()
          queryClient.clear()
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session, session.user)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      throw new Error(error.message)
    }
    const p = await fetchProfile(data.user.id)
    setSession(data.session, data.user)
    setProfile(p)
    setLoading(false)
    return p
  }, [setLoading, setSession, setProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    clearAuth()
    queryClient.clear()
    notify.info('You have been signed out.')
  }, [clearAuth])

  const changePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)

    // Clear the must_change_password flag
    const { error: profileError } = await db
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user!.id)

    if (profileError) throw new Error(profileError.message)

    setProfile({ ...profile!, must_change_password: false })
    notify.success('Password changed successfully.')
  }, [user, profile, setProfile])

  return {
    session,
    user,
    profile,
    isLoading,
    isInitialized,
    isAuthenticated: isAuthenticated(),
    mustChangePassword: mustChangePassword(),
    role: role(),
    branchId: branchId(),
    fullName: fullName(),
    signIn,
    signOut,
    changePassword,
  }
}

// Convenience hook for components that just need to check auth state
export function useRequireAuth() {
  const navigate = useNavigate()
  const { isAuthenticated, isInitialized, mustChangePassword } = useAuth()

  useEffect(() => {
    if (!isInitialized) return
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    } else if (mustChangePassword) {
      navigate('/change-password', { replace: true })
    }
  }, [isAuthenticated, isInitialized, mustChangePassword, navigate])

  return { isAuthenticated, isInitialized }
}
