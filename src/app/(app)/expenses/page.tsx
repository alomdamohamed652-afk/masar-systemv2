'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, EmptyState, LoadingSpinner, Pagination, Modal, FormGrid, SectionTitle } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Expense } from '@/types'

const EXPENSE_CATEGORIES = ['إيجار','مرتبات','شحن','مواد خام','تسويق','مصاريف إدارية','أخرى']

export default function ExpensesPage() {
  const { currency, timezone } = useSettings()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [count, setCount]       = useState(0)
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ beneficiary: '', phone: '', category: '', amount: '', notes: '', invoice_url: '' })
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, page: String(page), pageSize: '20' })
      if (category) params.set('category', category)
      const res  = await fetch(`/api/expenses?${params}`)
      const json = await res.json()
      setExpenses(json.data ?? [])
      setCount(json.count ?? 0)
    } catch { toast.error('خطأ في تحميل المصروفات') }
    finally { setLoading(false) }
  }, [search, category, page])

  useEffect(() => { load() }, [load])

  const uploadInvoice = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'expense-invoices')
      const res  = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setForm(f => ({ ...f, invoice_url: json.data.url }))
      toast.success('تم رفع الفاتورة')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل رفع الفاتورة')
    } finally { setUploading(false) }
  }

  const save = async () => {
    if (!form.amount || isNaN(Number(form.amount))) { toast.error('يرجى إدخال المبلغ'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم تسجيل المصروف')
      setModal(false)
      setForm({ beneficiary: '', phone: '', category: '', amount: '', notes: '', invoice_url: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    } finally { setSaving(false) }
  }

  const totalShown = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <>
      <PageHeader
        title="المصروفات"
        subtitle={`${count} سجل`}
        actions={<button className="btn btn-primary" onClick={() => setModal(true)}>+ مصروف جديد</button>}
      />

      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="بحث بالمستفيد أو الملاحظات..." />
          <select className="form-select" style={{ width: 180 }} value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}>
            <option value="">كل الفئات</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {!loading && expenses.length > 0 && (
          <div className="stat-card" style={{ marginBottom: 16, maxWidth: 280 }}>
            <div className="stat-label">إجمالي المصروفات المعروضة</div>
            <div className="stat-value negative">{formatCurrency(totalShown, currency)}</div>
          </div>
        )}

        <div className="card">
          {loading ? <LoadingSpinner centered /> : expenses.length === 0 ? (
            <EmptyState icon="💳" title="لا توجد مصروفات" />
          ) : (
            <>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr><th>المستفيد</th><th>الفئة</th><th>المبلغ</th><th>التاريخ</th><th>الفاتورة</th></tr></thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{e.beneficiary ?? '—'}</div>
                          {e.phone && <div style={{ fontSize: '.78rem', color: 'var(--color-text-muted)' }}>{e.phone}</div>}
                          {e.notes && <div style={{ fontSize: '.78rem', color: 'var(--color-text-muted)' }}>{e.notes}</div>}
                        </td>
                        <td>{e.category ? <span className="badge badge-gray">{e.category}</span> : '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-error)' }}>{formatCurrency(e.amount, currency)}</td>
                        <td style={{ fontSize: '.82rem', color: 'var(--color-text-muted)' }}>
                          {new Date(e.created_at).toLocaleDateString('ar-EG', { timeZone: timezone })}
                        </td>
                        <td>
                          {e.invoice_url
                            ? <a href={e.invoice_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">عرض</a>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={count} pageSize={20} onChange={setPage} />
            </>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="مصروف جديد" size="md"
        footer={<><button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'جارٍ...' : 'حفظ'}</button></>}
      >
        <FormGrid cols={2}>
          <div className="form-group"><label className="form-label">المستفيد</label><input className="form-input" value={form.beneficiary} onChange={e => setForm(f => ({ ...f, beneficiary: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">الهاتف</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
          <div className="form-group">
            <label className="form-label">الفئة</label>
            <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">اختر فئة</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">المبلغ <span className="required">*</span></label><input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} dir="ltr" /></div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">ملاحظات</label><textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">فاتورة (اختياري)</label>
            {form.invoice_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <a href={form.invoice_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">عرض الفاتورة</a>
                <button className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, invoice_url: '' }))}>حذف</button>
              </div>
            ) : (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', border: '1.5px dashed var(--color-border)', borderRadius: 8 }}>
                {uploading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <span>📎 رفع فاتورة</span>}
                <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadInvoice(e.target.files[0])} />
              </label>
            )}
          </div>
        </FormGrid>
      </Modal>
    </>
  )
}
