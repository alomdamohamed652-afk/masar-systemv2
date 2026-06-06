'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { PageHeader, FormGrid, SectionTitle, Modal } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Customer, Product, ProductVariant } from '@/types'

interface OrderItem {
  product_id: string; product_name: string
  variant_id: string; color: string; size: string
  quantity: number; unit_price: number
}

export default function NewOrderPage() {
  const router = useRouter()
  const { currency } = useSettings()
  const [saving, setSaving] = useState(false)

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customers, setCustomers]       = useState<Customer[]>([])
  const [customerId, setCustomerId]     = useState('')
  const [newCustomer, setNewCustomer]   = useState({ name: '', phone: '', email: '', address: '', governorate: '' })
  const [customerSearch, setCustomerSearch] = useState('')

  const [items, setItems]           = useState<OrderItem[]>([])
  const [productModal, setProductModal] = useState(false)
  const [products, setProducts]     = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [itemQty, setItemQty]       = useState(1)
  const [itemPrice, setItemPrice]   = useState('')

  const [internalNotes, setInternal]  = useState('')
  const [customerNotes, setCustomerN] = useState('')
  const [shippingCo, setShippingCo]   = useState('')
  const [tracking, setTracking]       = useState('')
  const [discount, setDiscount]       = useState('0')
  const [shippingCost, setShippingCost] = useState('0')

  useEffect(() => {
    fetch('/api/customers?pageSize=200').then(r => r.json()).then(j => setCustomers(j.data ?? []))
  }, [])

  useEffect(() => {
    if (!productModal) return
    const t = setTimeout(() => {
      fetch(`/api/products?search=${productSearch}&pageSize=20`)
        .then(r => r.json()).then(j => setProducts(j.data ?? []))
    }, 300)
    return () => clearTimeout(t)
  }, [productSearch, productModal])

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone ?? '').includes(customerSearch)
  )

  const selectProduct = (p: Product) => {
    setSelectedProduct(p)
    setSelectedVariant(null)
    setItemPrice(String(p.sell_price))
  }

  const addItem = () => {
    if (!selectedProduct || !selectedVariant) { toast.error('يرجى تحديد المتغير'); return }
    const price = Number(itemPrice) || selectedProduct.sell_price
    const exists = items.findIndex(i => i.variant_id === selectedVariant.id)
    if (exists >= 0) {
      setItems(prev => prev.map((i, idx) => idx === exists ? { ...i, quantity: i.quantity + itemQty } : i))
    } else {
      setItems(prev => [...prev, {
        product_id:   selectedProduct.id,
        product_name: selectedProduct.name,
        variant_id:   selectedVariant.id,
        color:        selectedVariant.color ?? '',
        size:         selectedVariant.size  ?? '',
        quantity:     itemQty,
        unit_price:   price,
      }])
    }
    setProductModal(false)
    setSelectedProduct(null); setSelectedVariant(null)
    setItemQty(1); setItemPrice('')
  }

  const subtotal     = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const discountN    = Number(discount) || 0
  const shippingN    = Number(shippingCost) || 0
  const total        = subtotal - discountN + shippingN

  const handleSave = async () => {
    if (customerMode === 'existing' && !customerId) { toast.error('يرجى اختيار العميل'); return }
    if (customerMode === 'new' && !newCustomer.name.trim()) { toast.error('اسم العميل مطلوب'); return }
    if (items.length === 0) { toast.error('يرجى اضافة منتج واحد على الاقل'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id:      customerMode === 'existing' ? customerId : undefined,
          new_customer:     customerMode === 'new' ? newCustomer : undefined,
          items,
          internal_notes:   internalNotes || null,
          customer_notes:   customerNotes || null,
          shipping_company: shippingCo || null,
          tracking_number:  tracking || null,
          discount:         discountN,
          shipping_cost:    shippingN,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم انشاء الطلب')
      router.push(`/orders/${json.data.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في انشاء الطلب')
    } finally { setSaving(false) }
  }

  const C = { label: (s: string) => <label className="form-label">{s}</label> }

  return (
    <>
      <PageHeader title="طلب جديد" />
      <div className="page-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

          {/* Customer section */}
          <div className="card card-pad">
            <SectionTitle>بيانات العميل</SectionTitle>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['existing','new'] as const).map(m => (
                <button key={m} className={`btn btn-sm ${customerMode === m ? 'btn-dark' : 'btn-outline'}`}
                  onClick={() => setCustomerMode(m)}>
                  {m === 'existing' ? 'عميل موجود' : 'عميل جديد'}
                </button>
              ))}
            </div>

            {customerMode === 'existing' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="form-input" placeholder="بحث بالاسم أو الهاتف..." value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)} />
                <select className="form-select" style={{ maxWidth: 400 }} value={customerId}
                  onChange={e => setCustomerId(e.target.value)}>
                  <option value="">اختر عميلاً...</option>
                  {filteredCustomers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <FormGrid cols={2}>
                <div className="form-group"><label className="form-label">الاسم <span className="required">*</span></label><input className="form-input" value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">الهاتف</label><input className="form-input" value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} dir="ltr" /></div>
                <div className="form-group"><label className="form-label">البريد</label><input className="form-input" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} dir="ltr" /></div>
                <div className="form-group"><label className="form-label">المحافظة</label><input className="form-input" value={newCustomer.governorate} onChange={e => setNewCustomer(p => ({ ...p, governorate: e.target.value }))} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">العنوان</label><input className="form-input" value={newCustomer.address} onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))} /></div>
              </FormGrid>
            )}
          </div>

          {/* Items section */}
          <div className="card card-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <SectionTitle>المنتجات</SectionTitle>
              <button className="btn btn-outline btn-sm" onClick={() => setProductModal(true)}>+ اضافة منتج</button>
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: '.9rem' }}>
                لم تُضف منتجات بعد
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, marginBottom: 16 }}>
                <table>
                  <thead><tr><th>المنتج</th><th>المتغير</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr></thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td style={{ color: 'var(--text-3)' }}>{[item.color, item.size].filter(Boolean).join(' / ') || '—'}</td>
                        <td>
                          <input type="number" min="1" value={item.quantity}
                            onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) } : it))}
                            style={{ width: 64, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontFamily: 'Cairo, sans-serif', background: 'var(--bg-card)', color: 'var(--text-1)' }} />
                        </td>
                        <td>
                          <input type="number" min="0" step="0.01" value={item.unit_price}
                            onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_price: Number(e.target.value) } : it))}
                            style={{ width: 90, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontFamily: 'Cairo, sans-serif', background: 'var(--bg-card)', color: 'var(--text-1)' }} />
                        </td>
                        <td style={{ fontWeight: 700 }}>{formatCurrency(item.quantity * item.unit_price, currency)}</td>
                        <td><button className="btn btn-danger btn-icon btn-sm" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 280 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>المجموع الفرعي</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.9rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>الخصم</span>
                  <input type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}
                    style={{ width: 100, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontFamily: 'Cairo, sans-serif', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: '.88rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.9rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>تكلفة الشحن</span>
                  <input type="number" min="0" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)}
                    style={{ width: 100, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontFamily: 'Cairo, sans-serif', background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: '.88rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem' }}>الإجمالي</span>
                  <span style={{ fontWeight: 900, color: 'var(--green)', fontSize: '1.15rem' }}>{formatCurrency(total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping & Notes */}
          <div className="card card-pad">
            <SectionTitle>الشحن والملاحظات</SectionTitle>
            <FormGrid cols={2}>
              <div className="form-group"><label className="form-label">شركة الشحن</label><input className="form-input" value={shippingCo} onChange={e => setShippingCo(e.target.value)} placeholder="Bosta, Aramex, J&T..." /></div>
              <div className="form-group"><label className="form-label">رقم التتبع</label><input className="form-input" value={tracking} onChange={e => setTracking(e.target.value)} dir="ltr" /></div>
              <div className="form-group"><label className="form-label">ملاحظات العميل</label><textarea className="form-textarea" rows={2} value={customerNotes} onChange={e => setCustomerN(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">ملاحظات داخلية</label><textarea className="form-textarea" rows={2} value={internalNotes} onChange={e => setInternal(e.target.value)} /></div>
            </FormGrid>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => router.back()}>إلغاء</button>
            <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> جارٍ الإنشاء...</> : 'انشاء الطلب'}
            </button>
          </div>
        </div>
      </div>

      {/* Product picker modal */}
      <Modal open={productModal} onClose={() => { setProductModal(false); setSelectedProduct(null); setSelectedVariant(null) }} title="اختر منتجاً" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input className="form-input" placeholder="بحث بالاسم أو SKU..." value={productSearch}
            onChange={e => setProductSearch(e.target.value)} autoFocus />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
            {products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)' }}>لا توجد منتجات</div>
            ) : products.map(p => (
              <div key={p.id}
                onClick={() => selectProduct(p)}
                style={{ border: `1.5px solid ${selectedProduct?.id === p.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', padding: 14, cursor: 'pointer', background: selectedProduct?.id === p.id ? 'var(--success-bg)' : 'var(--bg-card)', transition: 'all .15s' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                {p.variants && p.variants.length > 0 && selectedProduct?.id === p.id && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {p.variants.map(v => (
                      <button key={v.id} type="button"
                        className={`btn btn-sm ${selectedVariant?.id === v.id ? 'btn-dark' : 'btn-outline'}`}
                        onClick={e => { e.stopPropagation(); setSelectedVariant(v) }}>
                        {[v.color, v.size].filter(Boolean).join(' / ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedProduct && selectedVariant && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '0 0 80px' }}>
                <label className="form-label">الكمية</label>
                <input type="number" min="1" value={itemQty} onChange={e => setItemQty(Number(e.target.value))}
                  className="form-input" style={{ textAlign: 'center' }} />
              </div>
              <div className="form-group" style={{ flex: '0 0 120px' }}>
                <label className="form-label">السعر</label>
                <input type="number" min="0" step="0.01" value={itemPrice} onChange={e => setItemPrice(e.target.value)}
                  className="form-input" dir="ltr" />
              </div>
              <button className="btn btn-primary" onClick={addItem} style={{ marginBottom: 0, flex: 1 }}>
                اضافة للطلب
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
