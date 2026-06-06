import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('warehouses').select('*').order('name')
    if (error) throw error
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل المستودعات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (profile?.role !== 'founder') return NextResponse.json({ error: 'غير مصرح — المؤسس فقط' }, { status: 403 })

    const body = await request.json()
    if (!body.name?.trim()) return NextResponse.json({ error: 'اسم المستودع مطلوب' }, { status: 400 })

    const { data, error } = await service.from('warehouses').insert({
      name:    body.name.trim(),
      address: body.address || null,
      notes:   body.notes   || null,
    }).select().single()
    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile.name ?? '', userRole: 'founder',
      action: 'created', entity: 'warehouse', entityId: data.id,
      description: `تم إنشاء المستودع: ${data.name}`, request,
    })

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'خطأ في إنشاء المستودع' }, { status: 500 })
  }
}
