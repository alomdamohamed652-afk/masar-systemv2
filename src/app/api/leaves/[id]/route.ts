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

    const body = await request.json()
    if (!['approved','rejected'].includes(body.status)) {
      return NextResponse.json({ error: 'الحالة غير صالحة' }, { status: 400 })
    }

    const { data: before } = await service.from('leave_requests').select('status, user_id').eq('id', id).single()
    if (!before) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

    // CRITICAL FIX: Only update the leave request - never touch profiles
    const { data, error } = await service.from('leave_requests').update({
      status:      body.status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id).select('*, user:profiles!leave_requests_user_id_fkey(name)').single()

    if (error) throw error

    await logAudit({
      userId: user.id, userName: profile?.name ?? '',
      entity: 'leave_request', entityId: id,
      changes: [{ field: 'status', oldValue: before.status, newValue: body.status }],
    })

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'updated', entity: 'leave_request', entityId: id,
      description: `طلب إجازة ${(data.user as { name: string })?.name ?? ''} → ${body.status}`,
      request,
    })

    return NextResponse.json({ data, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تحديث طلب الإجازة'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
