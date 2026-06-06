import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const service = createServiceClient()

    // Get profile for name and role
    const { data: profile } = await service
      .from('profiles')
      .select('name, role')
      .eq('id', user.id)
      .single()

    // Update last_login_at
    await service
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // Write activity log
    await logActivity({
      userId: user.id,
      userName: profile?.name ?? user.email ?? 'مستخدم',
      userRole: profile?.role ?? 'employee',
      action: 'logged_in',
      entity: 'auth',
      description: 'تسجيل دخول ناجح',
      request,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[log-login]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
