import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { logAudit } from '@/lib/audit-logger'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { data: before } = await service.from('profiles').select('*').eq('id', id).single()
    if (!before) return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })

    const body = await request.json()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('role'      in body) update.role      = body.role
    if ('name'      in body) update.name      = body.name
    if ('phone'     in body) update.phone     = body.phone
    if ('is_active' in body) update.is_active = body.is_active

    // Role change — only founder
    if ('role' in body && profile?.role !== 'founder') {
      return NextResponse.json({ error: 'تغيير الأدوار للمؤسس فقط' }, { status: 403 })
    }

    const { data: updated, error } = await service
      .from('profiles').update(update).eq('id', id).select().single()
    if (error) throw error

    if (body.role && body.role !== before.role) {
      await logAudit({
        userId: user.id, userName: profile?.name ?? '',
        entity: 'user', entityId: id,
        changes: [{ field: 'role', oldValue: before.role, newValue: body.role }],
      })
    }

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'updated', entity: 'user', entityId: id,
      description: `تم تعديل المستخدم: ${updated.name}`, request,
    })

    return NextResponse.json({ data: updated, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تعديل المستخدم'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
