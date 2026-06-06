'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, EmptyState, LoadingSpinner, Pagination, Modal, FormGrid, TagInput } from '@/components/shared'
import type { Customer } from '@/types'

const CUSTOMER_TAGS = ['VIP','عميل متكرر','جملة','عميل مشكلة']

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [count, setCount]         = useState(0)
  const [search, setSearch]       = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ name: '', phone: '', email: '', address: '', governorate: '', notes: '', tags: [] as string[], facebook_url: '', instagram_username: '' })
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, page: String(page), pageSize: '20' })
      if (tagFilter) params.set('tag', tagFilter)
      const res  = await fetch(`/api/customers?${params}`)
      const json = await res.json()
      setCustomers(json.data ?? [])
      setCount(json.count ?? 0)
    } catch {
      toast.error('خطأ في تحميل العملاء')
    } finally {
      setLoading(false)
    }
  }, [search, tagFilter, page])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name.trim()) { toast.error('اسم العميل مطلوب'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم إضافة العميل')
      setModal(false)
      setForm({ name: '', phone: '', email: '', address: '', governorate: '', notes: '', tags: [], facebook_url: '', instagram_username: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle={`${count} عميل`}
        actions={<button className="btn btn-primary" onClick={() => setModal(true)}>+ عميل جديد</button>}
      />

      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="بحث بالاسم أو الهاتف..." />
          <select className="form-select" style={{ width: 160 }} value={tagFilter} onChange={e => { setTagFilter(e.target.value); setPage(1) }}>
            <option value="">كل الوسوم</option>
            {CUSTOMER_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="card">
          {loading ? <LoadingSpinner centered /> : customers.length === 0 ? (
            <EmptyState icon="👥" title="لا يوجد عملاء" />
          ) : (
            <>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr><th>الاسم</th><th>الهاتف</th><th>المحافظة</th><th>الوسوم</th><th></th></tr>
                  </thead>
                  <tbody>
                    {customers.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td style={{ direction: 'ltr', textAlign: 'right' }}>{c.phone ?? '—'}</td>
                        <td>{c.governorate ?? '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {c.tags.map(t => <span key={t} className="badge badge-dark">{t}</span>)}
                          </div>
                        </td>
                        <td><Link href={`/customers/${c.id}`} className="btn btn-ghost btn-sm">عرض</Link></td>
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

      <Modal open={modal} onClose={() => setModal(false)} title="عميل جديد" size="lg"
        footer={<><button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'جارٍ...' : 'إضافة'}</button></>}
      >
        <FormGrid cols={2}>
          <div className="form-group"><label className="form-label">الاسم <span className="required">*</span></label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">الهاتف</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
          <div className="form-group"><label className="form-label">البريد الإلكتروني</label><input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" /></div>
          <div className="form-group"><label className="form-label">المحافظة</label><input className="form-input" value={form.governorate} onChange={e => setForm(f => ({ ...f, governorate: e.target.value }))} /></div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">العنوان</label><input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">فيسبوك</label><input className="form-input" value={form.facebook_url} onChange={e => setForm(f => ({ ...f, facebook_url: e.target.value }))} dir="ltr" placeholder="https://facebook.com/..." /></div>
          <div className="form-group"><label className="form-label">إنستغرام</label><input className="form-input" value={form.instagram_username} onChange={e => setForm(f => ({ ...f, instagram_username: e.target.value }))} dir="ltr" placeholder="@username" /></div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">الوسوم</label>
            <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} suggestions={CUSTOMER_TAGS} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">ملاحظات</label><textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </FormGrid>
      </Modal>
    </>
  )
}
