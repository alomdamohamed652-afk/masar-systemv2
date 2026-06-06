import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { logAudit } from '@/lib/audit-logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignee:profiles!tasks_assigned_to_fkey(id, name),
        creator:profiles!tasks_created_by_fkey(id, name),
        comments:task_comments(*, user:profiles(id, name)),
        attachments:task_attachments(*)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 })
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل المهمة' }, { status: 500 })
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

    const { data: before } = await service.from('tasks').select('*').eq('id', id).single()
    if (!before) return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 })

    // Only manager/founder can update; assignee can update status only
    const isPrivileged = ['founder','manager'].includes(profile?.role ?? '')
    const isAssignee   = before.assigned_to === user.id
    if (!isPrivileged && !isAssignee) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (isPrivileged) {
      const fields = ['title','description','assigned_to','priority','status','due_date']
      for (const f of fields) { if (f in body) update[f] = body[f] }
    } else {
      if ('status' in body) update.status = body.status
    }

    const { data, error } = await service.from('tasks').update(update).eq('id', id).select().single()
    if (error) throw error

    if (body.status && body.status !== before.status) {
      await logAudit({
        userId: user.id, userName: profile?.name ?? '',
        entity: 'task', entityId: id,
        changes: [{ field: 'status', oldValue: before.status, newValue: body.status }],
      })
    }

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'updated', entity: 'task', entityId: id,
      description: `تم تعديل المهمة: ${data.title}`, request,
    })

    return NextResponse.json({ data, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تعديل المهمة'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
