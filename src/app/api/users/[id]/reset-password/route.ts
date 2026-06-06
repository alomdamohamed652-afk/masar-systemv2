import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (profile?.role !== 'founder') {
      return NextResponse.json({ error: 'إعادة تعيين كلمة المرور للمؤسس فقط' }, { status: 403 })
    }

    const { new_password } = await request.json()
    if (!new_password || new_password.length < 8) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 })
    }

    const { error } = await service.auth.admin.updateUserById(id, { password: new_password })
    if (error) throw error

    const { data: target } = await service.from('profiles').select('name').eq('id', id).single()

    await logActivity({
      userId: user.id, userName: profile.name ?? '', userRole: 'founder',
      action: 'reset_password', entity: 'user', entityId: id,
      description: `تم إعادة تعيين كلمة مرور المستخدم: ${target?.name}`, request,
    })

    return NextResponse.json({ data: { ok: true }, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في إعادة تعيين كلمة المرور'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
