import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search   = searchParams.get('search') ?? ''
    const category = searchParams.get('category') ?? ''
    const dateFrom = searchParams.get('from') ?? ''
    const dateTo   = searchParams.get('to') ?? ''
    const page     = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase
      .from('expenses')
      .select('*, creator:profiles(id, name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) query = query.or(`beneficiary.ilike.%${search}%,notes.ilike.%${search}%`)
    if (category) query = query.eq('category', category)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo)   query = query.lte('created_at', dateTo)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ data, count, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل المصروفات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager','accountant'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.amount || isNaN(Number(body.amount))) {
      return NextResponse.json({ error: 'يرجى إدخال المبلغ' }, { status: 400 })
    }

    const { data, error } = await service.from('expenses').insert({
      beneficiary: body.beneficiary || null,
      phone:       body.phone       || null,
      category:    body.category    || null,
      amount:      Number(body.amount),
      notes:       body.notes       || null,
      invoice_url: body.invoice_url || null,
      created_by:  user.id,
    }).select().single()
    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'created', entity: 'expense', entityId: data.id,
      description: `مصروف: ${data.category ?? 'غير محدد'} — ${data.amount}`, request,
    })

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تسجيل المصروف'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
