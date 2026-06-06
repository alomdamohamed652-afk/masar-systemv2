import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    const isPrivileged = ['founder','manager'].includes(profile?.role ?? '')

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? ''

    let query = supabase
      .from('leave_requests')
      .select('*, user:profiles!leave_requests_user_id_fkey(id, name, role), reviewer:profiles!leave_requests_reviewed_by_fkey(id, name)')
      .order('created_at', { ascending: false })

    if (!isPrivileged) query = query.eq('user_id', user.id)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل طلبات الإجازة' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()

    const body = await request.json()
    if (!body.start_date || !body.end_date) {
      return NextResponse.json({ error: 'يرجى تحديد تواريخ الإجازة' }, { status: 400 })
    }

    const { data, error } = await service.from('leave_requests').insert({
      user_id:    user.id,
      type:       body.type       || 'annual',
      start_date: body.start_date,
      end_date:   body.end_date,
      reason:     body.reason     || null,
      status:     'pending',
    }).select().single()
    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'created', entity: 'leave_request', entityId: data.id,
      description: `طلب إجازة من ${data.start_date} إلى ${data.end_date}`, request,
    })

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في إنشاء طلب الإجازة'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
