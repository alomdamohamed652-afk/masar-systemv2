'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, RolePermissions } from '@/types'
import type { User } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  permissions: RolePermissions | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  can: (permission: keyof Omit<RolePermissions, 'id' | 'role' | 'updated_at'>) => boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null, profile: null, permissions: null, loading: true,
  signOut: async () => {}, refreshProfile: async () => {}, can: () => false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null)
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<RolePermissions | null>(null)
  const [loading, setLoading]         = useState(true)
  const supabase = createClient()

  const loadProfileAndPerms = useCallback(async (userId: string): Promise<void> => {
    try {
      // Always fetch fresh from server - no caching
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !prof) {
        console.error('[auth] profile fetch error:', error?.message)
        return
      }

      setProfile(prof)

      // Founder always has all permissions - skip DB query
      if (prof.role === 'founder') {
        setPermissions({
          id: 'founder', role: 'founder',
          orders: true, products: true, inventory: true,
          customers: true, expenses: true, reports: true,
          hr: true, settings: true,
          updated_at: new Date().toISOString(),
        })
        return
      }

      const { data: perms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role', prof.role)
        .single()

      if (perms) setPermissions(perms)
    } catch (e) {
      console.error('[auth] loadProfile error:', e)
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfileAndPerms(user.id)
  }, [user, loadProfileAndPerms])

  useEffect(() => {
    let mounted = true

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        setUser(session.user)
        await loadProfileAndPerms(session.user.id)
      }
      setLoading(false)
    })

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setPermissions(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          await loadProfileAndPerms(session.user.id)

          // Throttled last_active update
          if (event === 'SIGNED_IN') {
            supabase.from('profiles')
              .update({ last_login_at: new Date().toISOString() })
              .eq('id', session.user.id)
              .then(() => {})
          } else {
            const key = 'masar_last_active'
            const last = localStorage.getItem(key)
            const now  = Date.now()
            if (!last || now - parseInt(last) > 5 * 60 * 1000) {
              localStorage.setItem(key, String(now))
              supabase.from('profiles')
                .update({ last_active_at: new Date().toISOString() })
                .eq('id', session.user.id)
                .then(() => {})
            }
          }
        }

        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, loadProfileAndPerms])

  const signOut = useCallback(async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setPermissions(null)
    } finally {
      setLoading(false)
      window.location.replace('/login')
    }
  }, [supabase])

  const can = useCallback(
    (permission: keyof Omit<RolePermissions, 'id' | 'role' | 'updated_at'>): boolean => {
      if (!profile) return false
      if (profile.role === 'founder') return true
      if (!permissions) return false
      return permissions[permission] === true
    },
    [profile, permissions]
  )

  return (
    <AuthContext.Provider value={{ user, profile, permissions, loading, signOut, refreshProfile, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
