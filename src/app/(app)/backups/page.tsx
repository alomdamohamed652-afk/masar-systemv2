'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingSpinner, ConfirmDialog } from '@/components/shared'
import { formatFileSize } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Backup } from '@/types'

export default function BackupsPage() {
  const { timezone } = useSettings()
  const [backups, setBackups]   = useState<Backup[]>([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm]   = useState(false)

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/backups')
    const json = await res.json()
    setBackups(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const createBackup = async () => {
    setCreating(true)
    setConfirm(false)
    try {
      const res  = await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'json' }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم إنشاء النسخة الاحتياطية')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في إنشاء النسخة الاحتياطية')
    } finally { setCreating(false) }
  }

  return (
    <>
      <PageHeader
        title="النسخ الاحتياطية"
        subtitle="نسخ احتياطي كامل بصيغة JSON — مخزّن في Supabase Storage"
        actions={
          <button className="btn btn-primary" onClick={() => setConfirm(true)} disabled={creating}>
            {creating ? <><span className="spinner" style={{ width: 14, height: 14 }} /> جارٍ الإنشاء...</> : '+ نسخة احتياطية الآن'}
          </button>
        }
      />

      <div className="page-body">
        <div style={{ padding: '14px 18px', background: 'var(--color-info-bg)', border: '1px solid #b8d0f0', borderRadius: 12, marginBottom: 20, fontSize: '.88rem', color: 'var(--color-info)', lineHeight: 1.7 }}>
          <strong>تنبيه:</strong> النسخة الاحتياطية تشمل جميع الجداول بصيغة JSON وتُرفع مباشرة إلى Supabase Storage.
          لا يتم تخزين أي ملفات محلياً ولا يختفي شيء عند إعادة تشغيل الخادم.
        </div>

        <div className="card">
          {loading ? <LoadingSpinner centered /> : backups.length === 0 ? (
            <EmptyState icon="💾" title="لا توجد نسخ احتياطية" description="أنشئ أول نسخة احتياطية للبدء" />
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr><th>اسم الملف</th><th>النوع</th><th>الحجم</th><th>أنشأه</th><th>التاريخ</th><th></th></tr>
                </thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{b.file_name ?? '—'}</td>
                      <td><span className="badge badge-blue">{b.type}</span></td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '.85rem' }}>{b.size_bytes ? formatFileSize(b.size_bytes) : '—'}</td>
                      <td style={{ fontSize: '.88rem' }}>{(b.creator as { name: string } | null)?.name ?? '—'}</td>
                      <td style={{ fontSize: '.82rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(b.created_at).toLocaleString('ar-EG', { timeZone: timezone })}
                      </td>
                      <td>
                        <a href={b.file_url} download target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">⬇ تنزيل</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="إنشاء نسخة احتياطية"
        message="سيتم تصدير جميع بيانات النظام كملف JSON ورفعه إلى Supabase Storage. هذه العملية قد تستغرق دقيقة. هل تريد المتابعة؟"
        confirmLabel="إنشاء النسخة"
        onConfirm={createBackup}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
