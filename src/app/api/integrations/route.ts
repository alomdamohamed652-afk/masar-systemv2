import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { data, error } = await service.from('integrations').select('*').order('name')
    if (error) throw error
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل التكاملات' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (profile?.role !== 'founder') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    if (!body.name) return NextResponse.json({ error: 'اسم التكامل مطلوب' }, { status: 400 })

    const { data, error } = await service
      .from('integrations')
      .update({
        api_key: body.api_key ?? null,
        status:  body.api_key ? 'active' : 'inactive',
      })
      .eq('name', body.name)
      .select()
      .single()

    if (error) throw error

    await logActivity({
      userId: user.id, userName: profile.name ?? '', userRole: 'founder',
      action: 'updated', entity: 'integration',
      description: `تم تحديث إعدادات التكامل: ${body.name}`, request,
    })

    return NextResponse.json({ data, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في حفظ التكامل'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
