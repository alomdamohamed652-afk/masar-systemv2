import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateFilePath } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = (formData.get('bucket') as string) || 'product-images'

    if (!file) return NextResponse.json({ error: 'لم يتم تحديد ملف' }, { status: 400 })

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز 5 ميغابايت' }, { status: 400 })
    }

    const allowed = ['image/jpeg','image/png','image/webp','image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 })
    }

    const path = generateFilePath('uploads', file.name)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: uploadErr } = await service.storage
      .from(bucket)
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadErr) throw uploadErr

    const { data: { publicUrl } } = service.storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({ data: { url: publicUrl, path }, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في رفع الملف'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
