'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { PageHeader, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/shared'
import { formatCurrency, ORDER_STATUS_LABELS, ORDER_STATUS_CLASS } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Order, OrderStatus } from '@/types'

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new:           ['processing','cancelled'],
  processing:    ['ready_to_ship','cancelled'],
  ready_to_ship: ['shipped','cancelled'],
  shipped:       ['delivered','returned'],
  delivered:     [],
  cancelled:     [],
  returned:      [],
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { currency, timezone } = useSettings()
  const [order, setOrder]           = useState<Order | null>(null)
  const [loading, setLoading]       = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null)
  const [editShipping, setEditShipping]   = useState(false)
  const [shippingForm, setShippingForm]   = useState({ tracking_number: '', shipping_company: '', shipping_cost: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/orders/${id}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setOrder(json.data)
      setShippingForm({
        tracking_number:  json.data.tracking_number  ?? '',
        shipping_company: json.data.shipping_company ?? '',
        shipping_cost:    String(json.data.shipping_cost ?? 0),
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في تحميل الطلب')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const changeStatus = async (newStatus: OrderStatus) => {
    setStatusLoading(true)
    try {
      const res  = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`تم تغيير الحالة: ${ORDER_STATUS_LABELS[newStatus]}`)
      setOrder(prev => prev ? { ...prev, status: newStatus } : prev)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في تغيير الحالة')
    } finally { setStatusLoading(false); setConfirmStatus(null) }
  }

  const saveShipping = async () => {
    try {
      const res  = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_number:  shippingForm.tracking_number  || null,
          shipping_company: shippingForm.shipping_company || null,
          shipping_cost:    Number(shippingForm.shipping_cost) || 0,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم حفظ معلومات الشحن')
      setEditShipping(false)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    }
  }

  const openWhatsApp = async () => {
    try {
      const res  = await fetch(`/api/orders/${id}/whatsapp`)
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      window.open(json.data.url, '_blank')
    } catch { toast.error('خطأ في فتح واتساب') }
  }

  if (loading) return <LoadingSpinner centered />
  if (!order)  return <EmptyState icon="❌" title="الطلب غير موجود" />

  const customer  = order.customer as { name: string; phone: string | null } | null
  const nextStats = NEXT_STATUSES[order.status as OrderStatus] ?? []
  const orderAny = order as unknown as Record<string, unknown>

  return (
    <>
      <PageHeader
        title={`طلب #${order.order_number}`}
        subtitle={new Date(order.created_at).toLocaleString('ar-EG', { timeZone: timezone })}
        actions={
          <span className={`badge ${ORDER_STATUS_CLASS[order.status as OrderStatus]}`} style={{ fontSize: '.88rem', padding: '6px 14px' }}>
            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
          </span>
        }
      />

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Customer */}
            <div className="card card-pad">
              <h3 style={{ marginBottom: 12 }}>بيانات العميل</h3>
              {customer ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{customer.name}</div>
                  {customer.phone && (
                    <div style={{ color: 'var(--text-2)', direction: 'ltr', textAlign: 'right', fontWeight: 500 }}>
                      {customer.phone}
                    </div>
                  )}
                  {order.customer_notes && (
                    <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', fontSize: '.85rem', color: 'var(--warning)' }}>
                      <strong>ملاحظة العميل:</strong> {order.customer_notes}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--text-3)' }}>لا يوجد عميل</p>
              )}

              {/* WhatsApp */}
              {customer?.phone && (
                <button onClick={openWhatsApp} style={{
                  marginTop: 14, width: '100%', padding: '11px',
                  borderRadius: 'var(--radius-md)',
                  background: '#25D366', color: '#fff', border: 'none',
                  cursor: 'pointer', fontFamily: 'Cairo, sans-serif',
                  fontWeight: 700, fontSize: '.95rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity .15s',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '.88'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                >
                  تحديث واتساب
                </button>
              )}
            </div>

            {/* Status actions */}
            {nextStats.length > 0 && (
              <div className="card card-pad">
                <h3 style={{ marginBottom: 12 }}>تغيير الحالة</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {nextStats.map(s => (
                    <button key={s}
                      className={`btn ${s === 'cancelled' || s === 'returned' ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => setConfirmStatus(s)} disabled={statusLoading}>
                      {ORDER_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Shipping info */}
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3>معلومات الشحن</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditShipping(!editShipping)}>
                  {editShipping ? 'إلغاء' : 'تعديل'}
                </button>
              </div>
              {editShipping ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">شركة الشحن</label>
                    <input className="form-input" value={shippingForm.shipping_company}
                      onChange={e => setShippingForm(f => ({ ...f, shipping_company: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">رقم التتبع</label>
                    <input className="form-input" value={shippingForm.tracking_number}
                      onChange={e => setShippingForm(f => ({ ...f, tracking_number: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">تكلفة الشحن</label>
                    <input className="form-input" type="number" min="0" step="0.01"
                      value={shippingForm.shipping_cost}
                      onChange={e => setShippingForm(f => ({ ...f, shipping_cost: e.target.value }))} dir="ltr" />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={saveShipping}>حفظ</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>شركة الشحن</span>
                    <span style={{ fontWeight: 600 }}>{order.shipping_company ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>رقم التتبع</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, direction: 'ltr' }}>{order.tracking_number ?? '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>تكلفة الشحن</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(Number(orderAny.shipping_cost ?? 0), currency)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Order items */}
            <div className="card">
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3>المنتجات</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.87rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                    {['المنتج','الكمية','السعر','الإجمالي'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, fontSize: '.74rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{(item.product as { name: string } | null)?.name ?? '—'}</div>
                        {(item.color || item.size) && (
                          <div style={{ fontSize: '.78rem', color: 'var(--text-3)', marginTop: 2 }}>
                            {[item.color, item.size].filter(Boolean).join(' / ')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{item.quantity}</td>
                      <td style={{ padding: '12px 16px' }}>{formatCurrency(item.unit_price, currency)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{formatCurrency(item.total_price, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-2)' }}>المجموع الفرعي</span>
                  <span>{formatCurrency(order.subtotal, currency)}</span>
                </div>
                {order.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--error)' }}>
                    <span>الخصم</span>
                    <span>- {formatCurrency(order.discount, currency)}</span>
                  </div>
                )}
                {Number(orderAny.shipping_cost ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-2)' }}>الشحن</span>
                    <span>{formatCurrency(Number(orderAny.shipping_cost), currency)}</span>
                  </div>
                )}
                {order.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-2)' }}>الضريبة</span>
                    <span>{formatCurrency(order.tax, currency)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem' }}>الإجمالي</span>
                  <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: '1.15rem' }}>{formatCurrency(order.total, currency)}</span>
                </div>
              </div>
            </div>

            {/* Internal notes */}
            {order.internal_notes && (
              <div className="card card-pad" style={{ background: 'var(--info-bg)', borderColor: '#b8d4f0' }}>
                <h3 style={{ marginBottom: 8, color: 'var(--info)', fontSize: '.95rem' }}>ملاحظات داخلية</h3>
                <p style={{ color: 'var(--info)', fontSize: '.9rem', lineHeight: 1.7 }}>{order.internal_notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmStatus}
        title="تأكيد تغيير الحالة"
        message={`تغيير الطلب إلى "${confirmStatus ? ORDER_STATUS_LABELS[confirmStatus] : ''}"؟${confirmStatus === 'processing' ? '\n\nسيتم خصم الكميات من المخزون.' : ''}`}
        confirmLabel="تأكيد"
        danger={confirmStatus === 'cancelled' || confirmStatus === 'returned'}
        loading={statusLoading}
        onConfirm={() => confirmStatus && changeStatus(confirmStatus)}
        onCancel={() => setConfirmStatus(null)}
      />
    </>
  )
}
