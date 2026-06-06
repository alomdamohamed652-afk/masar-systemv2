'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, EmptyState, LoadingSpinner, Modal, FormGrid } from '@/components/shared'
import { MOVEMENT_LABELS } from '@/lib/formatters'
import type { Warehouse, MovementType } from '@/types'

interface StockRow {
  id: string; quantity: number
  warehouse: { id: string; name: string }
  product: { id: string; name: string; sku: string | null }
  variant: { id: string; color: string | null; size: string | null }
}

const MOVEMENT_TYPES: MovementType[] = ['add','remove','adjustment','damaged','customer_return','warehouse_transfer']

export default function InventoryPage() {
  const [stocks, setStocks]     = useState<StockRow[]>([])
  const [filtered, setFiltered] = useState<StockRow[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [movModal, setMovModal] = useState(false)
  const [movSaving, setMovSaving] = useState(false)
  const [products, setProducts] = useState<{ id: string; name: string; variants: { id: string; color: string | null; size: string | null }[] }[]>([])

  const [form, setForm] = useState({
    warehouse_id: '', product_id: '', variant_id: '',
    movement_type: 'add' as MovementType,
    quantity: 1, notes: '', to_warehouse_id: '',
  })

  const loadStocks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (warehouseId) params.set('warehouse_id', warehouseId)
      const res  = await fetch(`/api/inventory/stock?${params}`)
      const json = await res.json()
      setStocks(json.data ?? [])
    } catch { toast.error('خطأ في تحميل المخزون') }
    finally { setLoading(false) }
  }, [warehouseId])

  useEffect(() => { loadStocks() }, [loadStocks])

  useEffect(() => {
    fetch('/api/warehouses').then(r => r.json()).then(j => setWarehouses(j.data ?? []))
    fetch('/api/products?pageSize=200').then(r => r.json()).then(j => setProducts(j.data ?? []))
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? stocks.filter(s =>
      s.product.name.toLowerCase().includes(q) ||
      (s.variant.color?.toLowerCase().includes(q) ?? false) ||
      (s.variant.size?.toLowerCase().includes(q) ?? false) ||
      s.warehouse.name.toLowerCase().includes(q)
    ) : stocks)
  }, [search, stocks])

  const openModal = () => {
    setForm({ warehouse_id: warehouseId || '', product_id: '', variant_id: '', movement_type: 'add', quantity: 1, notes: '', to_warehouse_id: '' })
    setMovModal(true)
  }

  const saveMovement = async () => {
    if (!form.warehouse_id) { toast.error('يرجى اختيار المستودع'); return }
    if (!form.product_id)   { toast.error('يرجى اختيار المنتج');   return }
    if (!form.variant_id)   { toast.error('يرجى اختيار المتغير');  return }
    if (!form.quantity)     { toast.error('يرجى ادخال الكمية');    return }
    if (form.movement_type === 'warehouse_transfer' && !form.to_warehouse_id) {
      toast.error('يرجى اختيار المستودع المستقبل'); return
    }
    if (form.movement_type === 'warehouse_transfer' && form.to_warehouse_id === form.warehouse_id) {
      toast.error('المستودع المصدر والمستقبل لا يمكن أن يكونا نفس المستودع'); return
    }

    setMovSaving(true)
    try {
      const res  = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم تسجيل الحركة')
      setMovModal(false)
      loadStocks()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في تسجيل الحركة')
    } finally { setMovSaving(false) }
  }

  const selectedVariants = products.find(p => p.id === form.product_id)?.variants ?? []
  const isTransfer = form.movement_type === 'warehouse_transfer'
  const totalItems = filtered.reduce((s, r) => s + r.quantity, 0)

  return (
    <>
      <PageHeader
        title="المخزون"
        subtitle={`${filtered.length} سجل — ${totalItems} وحدة إجمالي`}
        actions={<button className="btn btn-primary" onClick={openModal}>+ حركة مخزون</button>}
      />

      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="بحث بالمنتج أو اللون أو المقاس..." />
          <select className="form-select" style={{ width: 180 }} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
            <option value="">كل المستودعات</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div className="card">
          {loading ? <LoadingSpinner centered /> : filtered.length === 0 ? (
            <EmptyState icon="📦" title="لا يوجد مخزون" description="سجّل حركات مخزون لتظهر هنا" />
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>المستودع</th><th>الكمية</th></tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.product.name}</td>
                      <td>{s.variant.color ?? '—'}</td>
                      <td>{s.variant.size ?? '—'}</td>
                      <td>{s.warehouse.name}</td>
                      <td>
                        <span className={`badge ${s.quantity > 10 ? 'badge-green' : s.quantity > 0 ? 'badge-yellow' : 'badge-red'}`}>
                          {s.quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={movModal} onClose={() => setMovModal(false)} title="تسجيل حركة مخزون" size="md"
        footer={<>
          <button className="btn btn-outline" onClick={() => setMovModal(false)}>إلغاء</button>
          <button className="btn btn-primary" onClick={saveMovement} disabled={movSaving}>
            {movSaving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> جارٍ...</> : 'تسجيل'}
          </button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Movement type */}
          <div className="form-group">
            <label className="form-label">نوع الحركة <span className="required">*</span></label>
            <select className="form-select" value={form.movement_type}
              onChange={e => setForm(f => ({ ...f, movement_type: e.target.value as MovementType, to_warehouse_id: '' }))}>
              {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>)}
            </select>
          </div>

          <FormGrid cols={2}>
            {/* Source warehouse */}
            <div className="form-group">
              <label className="form-label">{isTransfer ? 'المستودع المصدر' : 'المستودع'} <span className="required">*</span></label>
              <select className="form-select" value={form.warehouse_id}
                onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                <option value="">اختر مستودعاً</option>
                {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* Target warehouse (only for transfer) */}
            {isTransfer ? (
              <div className="form-group">
                <label className="form-label">المستودع المستقبل <span className="required">*</span></label>
                <select className="form-select" value={form.to_warehouse_id}
                  onChange={e => setForm(f => ({ ...f, to_warehouse_id: e.target.value }))}>
                  <option value="">اختر مستودعاً</option>
                  {warehouses.filter(w => w.is_active && w.id !== form.warehouse_id).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">الكمية <span className="required">*</span></label>
                <input className="form-input" type="number" min="1" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} dir="ltr" />
              </div>
            )}

            {/* Product */}
            <div className="form-group">
              <label className="form-label">المنتج <span className="required">*</span></label>
              <select className="form-select" value={form.product_id}
                onChange={e => setForm(f => ({ ...f, product_id: e.target.value, variant_id: '' }))}>
                <option value="">اختر منتجاً</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Variant */}
            <div className="form-group">
              <label className="form-label">المتغير <span className="required">*</span></label>
              <select className="form-select" value={form.variant_id}
                onChange={e => setForm(f => ({ ...f, variant_id: e.target.value }))}>
                <option value="">اختر متغيراً</option>
                {selectedVariants.map(v => (
                  <option key={v.id} value={v.id}>
                    {[v.color, v.size].filter(Boolean).join(' / ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity (only for transfer — moved below) */}
            {isTransfer && (
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">الكمية <span className="required">*</span></label>
                <input className="form-input" type="number" min="1" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} dir="ltr" />
              </div>
            )}
          </FormGrid>

          <div className="form-group">
            <label className="form-label">ملاحظات</label>
            <textarea className="form-textarea" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Transfer summary */}
          {isTransfer && form.warehouse_id && form.to_warehouse_id && (
            <div style={{ padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', fontSize: '.85rem', color: 'var(--info)' }}>
              نقل {form.quantity} وحدة من <strong>{warehouses.find(w => w.id === form.warehouse_id)?.name}</strong> إلى <strong>{warehouses.find(w => w.id === form.to_warehouse_id)?.name}</strong>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
