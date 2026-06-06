import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('task_comments')
      .select('*, user:profiles(id, name)')
      .eq('task_id', id)
      .order('created_at')

    if (error) throw error
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل التعليقات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const body = await request.json()
    if (!body.content?.trim()) return NextResponse.json({ error: 'يرجى كتابة تعليق' }, { status: 400 })

    const { data, error } = await service.from('task_comments').insert({
      task_id: id,
      user_id: user.id,
      content: body.content.trim(),
    }).select('*, user:profiles(id, name)').single()
    if (error) throw error

    return NextResponse.json({ data, error: null }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'خطأ في إضافة التعليق' }, { status: 500 })
  }
}
