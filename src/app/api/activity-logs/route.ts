import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()

    const { searchParams } = new URL(request.url)
    const search   = searchParams.get('search') ?? ''
    const entity   = searchParams.get('entity') ?? ''
    const action   = searchParams.get('action') ?? ''
    const dateFrom = searchParams.get('from') ?? ''
    const dateTo   = searchParams.get('to') ?? ''
    const page     = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '50')
    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(from, to)

    if (!['founder','manager'].includes(profile?.role ?? '')) {
      query = query.eq('user_id', user.id)
    }

    if (search) query = query.or(`user_name.ilike.%${search}%,description.ilike.%${search}%`)
    if (entity) query = query.eq('entity', entity)
    if (action) query = query.eq('action', action)
    if (dateFrom) query = query.gte('timestamp', dateFrom)
    if (dateTo)   query = query.lte('timestamp', dateTo)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ data, count, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل سجل النشاط' }, { status: 500 })
  }
}
