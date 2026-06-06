import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

/**
 * Get the currently authenticated user + their profile
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<{
  userId: string
  profile: Profile
} | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  return { userId: user.id, profile }
}

/**
 * Require authentication — throws 401 response if not authenticated
 */
export async function requireAuth() {
  const result = await getCurrentUser()
  if (!result) {
    return { error: 'Unauthorized', status: 401, user: null, profile: null }
  }
  return { error: null, status: 200, ...result }
}

/**
 * Resolve login identifier to email
 * If identifier looks like a phone number, look up the email from profiles
 * Then sign in with email+password via Supabase Auth
 */
export async function resolveLoginIdentifier(
  identifier: string
): Promise<string | null> {
  // If it contains @ it's already an email
  if (identifier.includes('@')) return identifier

  // Otherwise treat as phone — look up in profiles
  const supabase = createServiceClient()
  const normalized = identifier.replace(/\s+/g, '').replace(/^00/, '+')

  const { data } = await supabase
    .from('profiles')
    .select('email')
    .eq('phone', normalized)
    .single()

  return data?.email ?? null
}

/**
 * Update last_login_at and last_active_at for a user
 */
export async function touchUserActivity(
  userId: string,
  field: 'last_login_at' | 'last_active_at' | 'both' = 'last_active_at'
) {
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const update: Record<string, string> = {}

  if (field === 'last_login_at' || field === 'both') update.last_login_at = now
  if (field === 'last_active_at' || field === 'both') update.last_active_at = now

  await supabase.from('profiles').update(update).eq('id', userId)
}

/**
 * Get role permissions for a given role
 */
export async function getRolePermissions(role: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('role', role)
    .single()
  return data
}

/**
 * Check if a profile has a specific permission
 */
export function hasPermission(
  profile: Profile,
  permission: keyof Omit<import('@/types').RolePermissions, 'id' | 'role' | 'updated_at'>
): boolean {
  // Founder always has all permissions
  if (profile.role === 'founder') return true
  // For other roles, permissions are checked via role_permissions table
  // This is used client-side after permissions are loaded
  return false
}
