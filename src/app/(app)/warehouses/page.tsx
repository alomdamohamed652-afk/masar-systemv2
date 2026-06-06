'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingSpinner, Modal, ConfirmDialog } from '@/components/shared'
import { useAuth } from '@/components/providers/auth-provider'
import type { Warehouse } from '@/types'

export default function WarehousesPage() {
  const { profile } = useAuth()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [editing, setEditing]       = useState<Warehouse | null>(null)
  const [form, setForm]             = useState({ name: '', address: '', notes: '' })
  const [saving, setSaving]         = useState(false)
  const [confirmDisable, setConfirmDisable] = useState<Warehouse | null>(null)

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/warehouses')
    const json = await res.json()
    setWarehouses(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ name: '', address: '', notes: '' }); setModal(true) }
  const openEdit   = (w: Warehouse) => { setEditing(w); setForm({ name: w.name, address: w.address ?? '', notes: w.notes ?? '' }); setModal(true) }

  const save = async () => {
    if (!form.name.trim()) { toast.error('اسم المستودع مطلوب'); return }
    setSaving(true)
    try {
      const url    = editing ? `/api/warehouses/${editing.id}` : '/api/warehouses'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json   = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(editing ? 'تم التعديل' : 'تم إنشاء المستودع')
      setModal(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (w: Warehouse) => {
    try {
      const res  = await fetch(`/api/warehouses/${w.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !w.is_active }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(w.is_active ? 'تم تعطيل المستودع' : 'تم تفعيل المستودع')
      setConfirmDisable(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    }
  }

  const isFounder = profile?.role === 'founder'

  return (
    <>
      <PageHeader
        title="المستودعات"
        subtitle="إدارة مستودعات المخزون"
        actions={isFounder ? <button className="btn btn-primary" onClick={openCreate}>+ مستودع جديد</button> : undefined}
      />

      <div className="page-body">
        {loading ? <LoadingSpinner centered /> : warehouses.length === 0 ? (
          <EmptyState icon="🏭" title="لا توجد مستودعات" action={isFounder ? <button className="btn btn-primary" onClick={openCreate}>+ مستودع جديد</button> : undefined} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {warehouses.map(w => (
              <div key={w.id} className="card card-pad" style={{ opacity: w.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{w.name}</div>
                    <span className={`badge ${w.is_active ? 'badge-green' : 'badge-gray'}`} style={{ marginTop: 4 }}>
                      {w.is_active ? 'نشط' : 'معطّل'}
                    </span>
                  </div>
                  {isFounder && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(w)}>تعديل</button>
                      <button className={`btn btn-sm ${w.is_active ? 'btn-danger' : 'btn-outline'}`} onClick={() => setConfirmDisable(w)}>
                        {w.is_active ? 'تعطيل' : 'تفعيل'}
                      </button>
                    </div>
                  )}
                </div>
                {w.address && <div style={{ fontSize: '.85rem', color: 'var(--color-text-muted)' }}>📍 {w.address}</div>}
                {w.notes && <div style={{ fontSize: '.82rem', color: 'var(--color-text-muted)', marginTop: 6 }}>{w.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل المستودع' : 'مستودع جديد'} size="sm"
        footer={<><button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'جارٍ...' : 'حفظ'}</button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">الاسم <span className="required">*</span></label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus /></div>
          <div className="form-group"><label className="form-label">العنوان</label><input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">ملاحظات</label><textarea className="form-textarea" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDisable}
        title={confirmDisable?.is_active ? 'تعطيل المستودع' : 'تفعيل المستودع'}
        message={`هل تريد ${confirmDisable?.is_active ? 'تعطيل' : 'تفعيل'} المستودع "${confirmDisable?.name}"؟`}
        confirmLabel="تأكيد"
        danger={confirmDisable?.is_active}
        onConfirm={() => confirmDisable && toggleActive(confirmDisable)}
        onCancel={() => setConfirmDisable(null)}
      />
    </>
  )
}
