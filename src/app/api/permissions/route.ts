import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { logAudit, diffObjects } from '@/lib/audit-logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('role_permissions').select('*').order('role')
    if (error) throw error
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل الصلاحيات' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (profile?.role !== 'founder') {
      return NextResponse.json({ error: 'تعديل الصلاحيات للمؤسس فقط' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.role) return NextResponse.json({ error: 'يرجى تحديد الدور' }, { status: 400 })
    if (body.role === 'founder') {
      return NextResponse.json({ error: 'لا يمكن تعديل صلاحيات المؤسس' }, { status: 400 })
    }

    const { data: before } = await service
      .from('role_permissions').select('*').eq('role', body.role).single()
    if (!before) return NextResponse.json({ error: 'الدور غير موجود' }, { status: 404 })

    const permFields = ['orders','products','inventory','customers','expenses','reports','hr','settings']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const f of permFields) { if (f in body) update[f] = body[f] }

    const { data, error } = await service
      .from('role_permissions').update(update).eq('role', body.role).select().single()
    if (error) throw error

    const changes = diffObjects(before as Record<string, unknown>, update, permFields)
    if (changes.length) {
      await logAudit({
        userId: user.id, userName: profile.name ?? '',
        entity: 'permission', entityId: before.id,
        changes: changes.map(c => ({ ...c, field: `${body.role}.${c.field}` })),
      })
    }

    await logActivity({
      userId: user.id, userName: profile.name ?? '', userRole: 'founder',
      action: 'updated', entity: 'permission',
      description: `تم تعديل صلاحيات الدور: ${body.role}`, request,
    })

    return NextResponse.json({ data, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تعديل الصلاحيات'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
