'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingSpinner, Modal, FormGrid } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Salary } from '@/types'

export default function SalariesPage() {
  const { currency } = useSettings()
  const [salaries, setSalaries] = useState<Salary[]>([])
  const [loading, setLoading]   = useState(true)
  const [month, setMonth]       = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [modal, setModal]       = useState(false)
  const [users, setUsers]       = useState<{ id: string; name: string }[]>([])
  const [form, setForm]         = useState({ user_id: '', month: '', base_salary: '', bonus: '', deduction: '', notes: '' })
  const [saving, setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/salaries?month=${month}`)
      const json = await res.json()
      setSalaries(json.data ?? [])
    } catch { toast.error('خطأ في تحميل الرواتب') }
    finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(j => setUsers(j.data ?? []))
  }, [])

  const openModal = () => {
    setForm({ user_id: '', month, base_salary: '', bonus: '0', deduction: '0', notes: '' })
    setModal(true)
  }

  const save = async () => {
    if (!form.user_id)     { toast.error('يرجى اختيار الموظف'); return }
    if (!form.month)       { toast.error('يرجى تحديد الشهر'); return }
    if (!form.base_salary) { toast.error('يرجى إدخال الراتب الأساسي'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/salaries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, base_salary: Number(form.base_salary), bonus: Number(form.bonus || 0), deduction: Number(form.deduction || 0) }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم حفظ الراتب')
      setModal(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    } finally { setSaving(false) }
  }

  const totalPayroll = salaries.reduce((s, r) => s + Number(r.final_salary), 0)

  return (
    <>
      <PageHeader
        title="الرواتب"
        actions={<button className="btn btn-primary" onClick={openModal}>+ إضافة راتب</button>}
      />

      <div className="page-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <label className="form-label" style={{ marginBottom: 0 }}>الشهر:</label>
          <input type="month" className="form-input" style={{ width: 160 }} value={month} onChange={e => setMonth(e.target.value)} />
        </div>

        {!loading && salaries.length > 0 && (
          <div className="stat-card" style={{ marginBottom: 16, maxWidth: 280 }}>
            <div className="stat-label">إجمالي الرواتب — {month}</div>
            <div className="stat-value negative">{formatCurrency(totalPayroll, currency)}</div>
          </div>
        )}

        <div className="card">
          {loading ? <LoadingSpinner centered /> : salaries.length === 0 ? (
            <EmptyState icon="💰" title={`لا توجد رواتب لشهر ${month}`} action={<button className="btn btn-primary" onClick={openModal}>+ إضافة راتب</button>} />
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الراتب الأساسي</th>
                    <th>المكافأة</th>
                    <th>الخصم</th>
                    <th>الراتب الصافي</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{(s.user as { name: string } | null)?.name ?? '—'}</td>
                      <td>{formatCurrency(s.base_salary, currency)}</td>
                      <td style={{ color: s.bonus > 0 ? 'var(--color-green)' : undefined }}>
                        {s.bonus > 0 ? `+ ${formatCurrency(s.bonus, currency)}` : '—'}
                      </td>
                      <td style={{ color: s.deduction > 0 ? 'var(--color-error)' : undefined }}>
                        {s.deduction > 0 ? `- ${formatCurrency(s.deduction, currency)}` : '—'}
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--color-green)', fontSize: '1rem' }}>
                        {formatCurrency(s.final_salary, currency)}
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '.85rem' }}>{s.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="إضافة / تعديل راتب" size="md"
        footer={<><button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'جارٍ...' : 'حفظ'}</button></>}
      >
        <FormGrid cols={2}>
          <div className="form-group">
            <label className="form-label">الموظف <span className="required">*</span></label>
            <select className="form-select" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}>
              <option value="">اختر موظفاً</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">الشهر <span className="required">*</span></label>
            <input type="month" className="form-input" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">الراتب الأساسي <span className="required">*</span></label>
            <input type="number" className="form-input" min="0" step="0.01" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} dir="ltr" />
          </div>
          <div className="form-group">
            <label className="form-label">المكافأة</label>
            <input type="number" className="form-input" min="0" step="0.01" value={form.bonus} onChange={e => setForm(f => ({ ...f, bonus: e.target.value }))} dir="ltr" />
          </div>
          <div className="form-group">
            <label className="form-label">الخصم</label>
            <input type="number" className="form-input" min="0" step="0.01" value={form.deduction} onChange={e => setForm(f => ({ ...f, deduction: e.target.value }))} dir="ltr" />
          </div>
          {form.base_salary && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px 14px', background: 'var(--color-success-bg)', borderRadius: 10 }}>
              <div style={{ fontSize: '.78rem', color: 'var(--color-success)', fontWeight: 600 }}>الراتب الصافي</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-success)' }}>
                {formatCurrency(Number(form.base_salary) + Number(form.bonus || 0) - Number(form.deduction || 0), currency)}
              </div>
            </div>
          )}
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">ملاحظات</label>
            <textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </FormGrid>
      </Modal>
    </>
  )
}
