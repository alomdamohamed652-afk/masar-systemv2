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
    const tag      = searchParams.get('tag') ?? ''
    const page     = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    if (tag) query = query.contains('tags', [tag])

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ data, count, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل العملاء' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager','customer_service','accountant'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.name?.trim()) return NextResponse.json({ error: 'اسم العميل مطلوب' }, { status: 400 })

    const { data, error } = await service.from('customers').insert({
      name:               body.name.trim(),
      phone:              body.phone              || null,
      email:              body.email              || null,
      address:            body.address            || null,
      governorate:        body.governorate        || null,
      notes:              body.notes              || null,
      tags:               body.tags               ?? [],
      facebook_url:       body.facebook_url       || null,
      instagram_username: body.instagram_username || null,
    }).select().single()
    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'created', entity: 'customer', entityId: data.id,
      description: `تم إنشاء العميل: ${data.name}`, request,
    })

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في إنشاء العميل'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
