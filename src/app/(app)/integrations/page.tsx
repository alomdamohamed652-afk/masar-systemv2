'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, LoadingSpinner } from '@/components/shared'
import type { Integration } from '@/types'

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading]   = useState(true)
  const [apiKey, setApiKey]     = useState('')
  const [saving, setSaving]     = useState(false)

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/integrations')
    const json = await res.json()
    const data: Integration[] = json.data ?? []
    setIntegrations(data)
    const wuilt = data.find(i => i.name === 'wuilt')
    if (wuilt?.api_key) setApiKey(wuilt.api_key)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res  = await fetch('/api/integrations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'wuilt', api_key: apiKey || null }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم حفظ إعدادات Wuilt')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في الحفظ')
    } finally { setSaving(false) }
  }

  const wuilt = integrations.find(i => i.name === 'wuilt')

  if (loading) return <LoadingSpinner centered />

  return (
    <>
      <PageHeader title="التكاملات الخارجية" subtitle="إدارة الاتصالات مع المنصات الخارجية" />
      <div className="page-body">
        <div style={{ maxWidth: 600 }}>

          {/* Wuilt */}
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.1rem' }}>W</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Wuilt</div>
                <div style={{ fontSize: '.82rem', color: 'var(--color-text-muted)' }}>منصة التجارة الإلكترونية</div>
              </div>
              <span className={`badge ${wuilt?.status === 'active' ? 'badge-green' : 'badge-gray'}`} style={{ marginRight: 'auto' }}>
                {wuilt?.status === 'active' ? 'متصل' : 'غير متصل'}
              </span>
            </div>

            <div style={{ padding: '14px 16px', background: 'var(--color-warning-bg)', borderRadius: 10, marginBottom: 18, fontSize: '.85rem', color: 'var(--color-warning)', lineHeight: 1.7 }}>
              <strong>⏳ في انتظار توثيق API الرسمي</strong>
              <br />
              لم يتم تنفيذ منطق المزامنة بعد لأن وثائق Wuilt API لم تُراجع بعد.
              بمجرد توفر التوثيق، سيتم بناء نقطة نهاية المزامنة الكاملة على
              <code style={{ background: 'rgba(0,0,0,.08)', padding: '1px 5px', borderRadius: 4, marginRight: 4 }}>/api/integrations/wuilt/sync</code>
              مع ضمان عدم تكرار الطلبات (idempotency) باستخدام <code style={{ background: 'rgba(0,0,0,.08)', padding: '1px 5px', borderRadius: 4 }}>external_id</code>.
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">مفتاح API</label>
              <input
                className="form-input"
                type="password"
                dir="ltr"
                placeholder="6lW9NYenpmcCV9WGxlG2ycltUoz0_oKv2Fb1rrbQ9j4"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <div className="form-hint">احتفظ بمفتاح API سراً ولا تشاركه مع أحد</div>
            </div>

            {wuilt?.last_sync_at && (
              <div style={{ fontSize: '.82rem', color: 'var(--color-text-muted)', marginBottom: 14 }}>
                آخر مزامنة: {new Date(wuilt.last_sync_at).toLocaleString('ar-EG')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> جارٍ الحفظ...</> : 'حفظ المفتاح'}
              </button>
              <button
                className="btn btn-outline"
                disabled
                title="المزامنة غير متاحة — في انتظار توثيق API"
                style={{ opacity: .5, cursor: 'not-allowed' }}
              >
                مزامنة الآن
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-bg-subtle)', borderRadius: 10, fontSize: '.82rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
            <strong>ملاحظة للمطور:</strong> عند توفر وثائق Wuilt API، أضف منطق المزامنة في
            <code style={{ background: 'rgba(0,0,0,.08)', padding: '1px 5px', borderRadius: 4, margin: '0 4px' }}>src/app/api/integrations/wuilt/sync/route.ts</code>
            مع استخدام <code style={{ background: 'rgba(0,0,0,.08)', padding: '1px 5px', borderRadius: 4 }}>ON CONFLICT (source, external_id) DO NOTHING</code> لضمان عدم تكرار الاستيراد.
          </div>
        </div>
      </div>
    </>
  )
}
