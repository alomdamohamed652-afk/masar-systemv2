import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (profile?.role !== 'founder') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json()
    const { data, error } = await service
      .from('warehouses')
      .update({
        name:      body.name      ?? undefined,
        address:   body.address   ?? undefined,
        notes:     body.notes     ?? undefined,
        is_active: body.is_active ?? undefined,
      })
      .eq('id', id).select().single()
    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile.name ?? '', userRole: 'founder',
      action: 'updated', entity: 'warehouse', entityId: id,
      description: `تم تعديل المستودع: ${data.name}`, request,
    })

    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تعديل المستودع' }, { status: 500 })
  }
}
