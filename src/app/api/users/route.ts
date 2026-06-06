import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { data, error } = await service
      .from('profiles')
      .select('id, name, email, phone, role, is_active, last_login_at, last_active_at, created_at')
      .order('created_at')

    if (error) throw error
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل المستخدمين' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.email || !body.password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 })
    }

    // Create Supabase Auth user
    const { data: authData, error: authErr } = await service.auth.admin.createUser({
      email:          body.email,
      password:       body.password,
      email_confirm:  true, // auto-confirm since we're creating for them
      phone:          body.phone || undefined,
      user_metadata:  { name: body.name },
    })
    if (authErr) throw authErr

    // Update the auto-created profile
    await service.from('profiles').update({
      name:  body.name  || null,
      email: body.email,
      phone: body.phone || null,
      role:  body.role  || 'employee',
    }).eq('id', authData.user.id)

    const { data: newProfile } = await service
      .from('profiles').select('*').eq('id', authData.user.id).single()

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'created', entity: 'user', entityId: authData.user.id,
      description: `تم إنشاء المستخدم: ${body.name} (${body.role})`, request,
    })

    return NextResponse.json({ data: newProfile, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في إنشاء المستخدم'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
