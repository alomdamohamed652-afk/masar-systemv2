import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

const BACKUP_TABLES = [
  'settings','role_permissions','profiles',
  'categories','warehouses','products','product_images','product_variants',
  'warehouse_stocks','inventory_movements',
  'customers','orders','order_items','expenses',
  'tasks','task_comments','task_attachments',
  'salaries','leave_requests',
  'activity_logs','audit_logs','integrations',
]

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'founder') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const { data, error } = await service
      .from('backups').select('*, creator:profiles(name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل النسخ الاحتياطية' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (profile?.role !== 'founder') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const { type = 'json' } = await request.json()

    if (type === 'json') {
      const backup: Record<string, unknown[]> = {}

      for (const table of BACKUP_TABLES) {
        const { data } = await service.from(table).select('*')
        backup[table] = data ?? []
      }

      const json = JSON.stringify(backup, null, 2)
      const buffer = Buffer.from(json, 'utf-8')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `backup-${ts}.json`
      const path = `backups/${fileName}`

      const { error: uploadErr } = await service.storage
        .from('backups')
        .upload(path, buffer, { contentType: 'application/json', upsert: false })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = service.storage.from('backups').getPublicUrl(path)

      const { data: record } = await service.from('backups').insert({
        type: 'json',
        file_url:   publicUrl,
        file_name:  fileName,
        size_bytes: buffer.length,
        created_by: user.id,
      }).select().single()

      await logActivity({
        userId: user.id, userName: profile.name ?? '', userRole: 'founder',
        action: 'backup_created', entity: 'backup',
        description: `تم إنشاء نسخة احتياطية JSON — ${fileName}`, request,
      })

      return NextResponse.json({ data: record, error: null }, { status: 201 })
    }

    return NextResponse.json({ error: 'نوع النسخ غير مدعوم' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في إنشاء النسخة الاحتياطية'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
