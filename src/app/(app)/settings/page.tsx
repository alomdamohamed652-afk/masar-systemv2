'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, FormGrid, SectionTitle } from '@/components/shared'
import { TIMEZONES } from '@/lib/timezone'
import { useSettings } from '@/components/providers/settings-provider'
import type { Settings } from '@/types'

export default function SettingsPage() {
  const { refresh } = useSettings()
  const [form, setForm] = useState<Partial<Settings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [uploadingLight, setUploadingLight] = useState(false)
  const [uploadingDark,  setUploadingDark]  = useState(false)
  const lightRef = useRef<HTMLInputElement>(null)
  const darkRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(j => { if (j.data) setForm(j.data) }).finally(() => setLoading(false))
  }, [])

  const uploadLogo = async (file: File, type: 'light' | 'dark') => {
    const setter = type === 'light' ? setUploadingLight : setUploadingDark
    setter(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'logos')
      const res  = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setForm(f => ({ ...f, [type === 'light' ? 'logo_light_url' : 'logo_dark_url']: json.data.url }))
      toast.success('تم رفع الشعار')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'فشل الرفع') }
    finally { setter(false) }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res  = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم حفظ الإعدادات')
      refresh()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ في الحفظ') }
    finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" style={{ width: 28, height: 28 }} /></div>

  return (
    <>
      <PageHeader title="الإعدادات" actions={<button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>} />

      <div className="page-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 700 }}>

          {/* Brand */}
          <div className="card card-pad">
            <SectionTitle>هوية العلامة التجارية</SectionTitle>
            <FormGrid cols={2}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">اسم العلامة التجارية</label>
                <input className="form-input" value={form.brand_name ?? ''} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} />
              </div>

              {/* Light logo */}
              <div className="form-group">
                <label className="form-label">شعار (فاتح)</label>
                {form.logo_light_url ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={form.logo_light_url} alt="light logo" style={{ height: 48, objectFit: 'contain', background: '#f5f5f5', borderRadius: 8, padding: 4, border: '1px solid var(--color-border)' }} />
                    <button className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, logo_light_url: undefined }))}>حذف</button>
                  </div>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', border: '1.5px dashed var(--color-border)', borderRadius: 8 }}>
                    {uploadingLight ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '📤 رفع شعار فاتح'}
                    <input ref={lightRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0], 'light')} />
                  </label>
                )}
              </div>

              {/* Dark logo */}
              <div className="form-group">
                <label className="form-label">شعار (داكن)</label>
                {form.logo_dark_url ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={form.logo_dark_url} alt="dark logo" style={{ height: 48, objectFit: 'contain', background: '#222831', borderRadius: 8, padding: 4, border: '1px solid var(--color-border)' }} />
                    <button className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, logo_dark_url: undefined }))}>حذف</button>
                  </div>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', border: '1.5px dashed var(--color-border)', borderRadius: 8 }}>
                    {uploadingDark ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '📤 رفع شعار داكن'}
                    <input ref={darkRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0], 'dark')} />
                  </label>
                )}
              </div>
            </FormGrid>
          </div>

          {/* Regional */}
          <div className="card card-pad">
            <SectionTitle>الإعدادات الإقليمية</SectionTitle>
            <FormGrid cols={2}>
              <div className="form-group">
                <label className="form-label">العملة</label>
                <select className="form-select" value={form.currency ?? 'EGP'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="AED">درهم إماراتي (AED)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="EUR">يورو (EUR)</option>
                  <option value="GBP">جنيه إسترليني (GBP)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">المنطقة الزمنية</label>
                <select className="form-select" value={form.timezone ?? 'Africa/Cairo'} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                  {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">نسبة الضريبة (%)</label>
                <input type="number" className="form-input" min="0" max="100" step="0.01" value={form.tax_rate ?? 0} onChange={e => setForm(f => ({ ...f, tax_rate: Number(e.target.value) }))} dir="ltr" />
              </div>
              <div className="form-group">
                <label className="form-label">حد المخزون المنخفض</label>
                <input type="number" className="form-input" min="0" value={form.low_stock_threshold ?? 10} onChange={e => setForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) }))} dir="ltr" />
              </div>
            </FormGrid>
          </div>

          {/* Contact */}
          <div className="card card-pad">
            <SectionTitle>معلومات التواصل</SectionTitle>
            <FormGrid cols={2}>
              <div className="form-group"><label className="form-label">الهاتف</label><input className="form-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
              <div className="form-group"><label className="form-label">البريد الإلكتروني</label><input type="email" className="form-input" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" /></div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">العنوان</label><textarea className="form-textarea" rows={2} value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            </FormGrid>
          </div>

        </div>
      </div>
    </>
  )
}
