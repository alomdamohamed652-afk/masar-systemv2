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
    const month  = searchParams.get('month')  ?? '' // 'YYYY-MM'
    const userId = searchParams.get('user_id') ?? ''

    let query = supabase
      .from('salaries')
      .select('*, user:profiles(id, name, role)', { count: 'exact' })
      .order('month', { ascending: false })

    // month filtering: stored as DATE '2025-01-01', filter by truncation
    if (month) {
      const monthStart = `${month}-01`
      const [y, m]     = month.split('-').map(Number)
      const nextMonth  = m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`
      query = query.gte('month', monthStart).lt('month', nextMonth)
    }
    if (userId) query = query.eq('user_id', userId)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ data, count, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل الرواتب' }, { status: 500 })
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
    if (!body.user_id) return NextResponse.json({ error: 'يرجى تحديد الموظف' }, { status: 400 })
    if (!body.month)   return NextResponse.json({ error: 'يرجى تحديد الشهر' }, { status: 400 })

    // Normalize month to first day
    const monthStart = body.month.length === 7 ? `${body.month}-01` : body.month

    const { data, error } = await service.from('salaries').upsert({
      user_id:     body.user_id,
      month:       monthStart,
      base_salary: Number(body.base_salary ?? 0),
      bonus:       Number(body.bonus       ?? 0),
      deduction:   Number(body.deduction   ?? 0),
      notes:       body.notes || null,
    }, { onConflict: 'user_id,month' }).select('*, user:profiles(id, name)').single()
    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'created', entity: 'salary', entityId: data.id,
      description: `راتب ${data.user?.name} — ${monthStart}`, request,
    })

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تسجيل الراتب'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
