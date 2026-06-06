import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { logAudit, diffObjects } from '@/lib/audit-logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: customer, error } = await supabase
      .from('customers').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({ data: { ...customer, orders: orders ?? [] }, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل العميل' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager','customer_service','accountant'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { data: before } = await service.from('customers').select('*').eq('id', id).single()
    if (!before) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

    const body = await request.json()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const fields = ['name','phone','email','address','governorate','notes','tags','facebook_url','instagram_username']
    for (const f of fields) { if (f in body) update[f] = body[f] }

    const { data, error } = await service.from('customers').update(update).eq('id', id).select().single()
    if (error) throw error

    const changes = diffObjects(before, update as Record<string, unknown>, ['name','phone','tags','notes'])
    if (changes.length) {
      await logAudit({ userId: user.id, userName: profile?.name ?? '', entity: 'customer', entityId: id, changes })
    }

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'updated', entity: 'customer', entityId: id,
      description: `تم تعديل بيانات العميل: ${data.name}`, request,
    })

    return NextResponse.json({ data, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تعديل العميل'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
