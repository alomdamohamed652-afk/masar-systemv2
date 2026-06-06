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

    const { searchParams } = new URL(request.url)
    const status   = searchParams.get('status') ?? ''
    const priority = searchParams.get('priority') ?? ''
    const page     = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase
      .from('tasks')
      .select(`
        *,
        assignee:profiles!tasks_assigned_to_fkey(id, name),
        creator:profiles!tasks_created_by_fkey(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // Non-privileged users see only their own tasks
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    }

    if (status)   query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ data, count, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل المهام' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.title?.trim()) return NextResponse.json({ error: 'عنوان المهمة مطلوب' }, { status: 400 })

    const { data, error } = await service.from('tasks').insert({
      title:       body.title.trim(),
      description: body.description || null,
      assigned_to: body.assigned_to || null,
      created_by:  user.id,
      priority:    body.priority    || 'medium',
      status:      'open',
      due_date:    body.due_date    || null,
    }).select(`*, assignee:profiles!tasks_assigned_to_fkey(id, name)`).single()
    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'created', entity: 'task', entityId: data.id,
      description: `تم إنشاء المهمة: ${data.title}`, request,
    })

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في إنشاء المهمة'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
