'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/shared'
import ProductForm from '@/components/products/ProductForm'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Product, AuditLog } from '@/types'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { currency, timezone } = useSettings()
  const [product, setProduct] = useState<Product | null>(null)
  const [audits, setAudits]   = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<'edit' | 'stock' | 'audit'>('edit')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, aRes] = await Promise.all([
        fetch(`/api/products/${id}`),
        fetch(`/api/audit-logs?entity=product&entity_id=${id}&pageSize=20`),
      ])
      const pJson = await pRes.json()
      const aJson = await aRes.json()
      if (pJson.error) throw new Error(pJson.error)
      setProduct(pJson.data)
      setAudits(aJson.data ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في تحميل المنتج')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner centered />
  if (!product) return <EmptyState icon="❌" title="المنتج غير موجود" />

  const primaryImg = product.images?.find(i => i.is_primary) ?? product.images?.[0]

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={product.sku ? `SKU: ${product.sku}` : undefined}
        actions={
          <div style={{ display: 'flex', gap: 4 }}>
            {(['edit','stock','audit'] as const).map(t => (
              <button key={t} className={`btn btn-sm ${tab === t ? 'btn-dark' : 'btn-outline'}`} onClick={() => setTab(t)}>
                {t === 'edit' ? 'تعديل' : t === 'stock' ? 'المخزون' : 'سجل التغييرات'}
              </button>
            ))}
          </div>
        }
      />

      <div className="page-body">
        {tab === 'edit' && <ProductForm product={product} onSaved={load} />}

        {tab === 'stock' && (
          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3>المخزون الحالي</h3>
            </div>
            {product.variants?.length === 0 ? (
              <EmptyState icon="📦" title="لا توجد متغيرات" description="أضف متغيرات للمنتج أولاً" />
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr><th>اللون</th><th>المقاس</th><th>المستودع</th><th>الكمية</th></tr></thead>
                  <tbody>
                    {product.variants?.flatMap(v => {
                      type StockRow = { id: string; warehouse?: { name: string }; quantity: number }
                      const rows: StockRow[] = v.stock?.length ? v.stock as StockRow[] : [{ id: '', warehouse: { name: '—' }, quantity: 0 }]
                      return rows.map((s, si) => (
                        <tr key={`${v.id}-${si}`}>
                          <td>{v.color ?? '—'}</td>
                          <td>{v.size ?? '—'}</td>
                          <td>{s.warehouse?.name ?? '—'}</td>
                          <td>
                            <span className={`badge ${s.quantity > 10 ? 'badge-green' : s.quantity > 0 ? 'badge-yellow' : 'badge-red'}`}>
                              {s.quantity}
                            </span>
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3>سجل التغييرات</h3>
            </div>
            {audits.length === 0 ? (
              <EmptyState icon="📋" title="لا توجد تغييرات مسجلة" />
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr><th>الحقل</th><th>القيمة القديمة</th><th>القيمة الجديدة</th><th>المستخدم</th><th>التوقيت</th></tr></thead>
                  <tbody>
                    {audits.map(a => (
                      <tr key={a.id}>
                        <td><code style={{ fontSize: '.8rem' }}>{a.field}</code></td>
                        <td style={{ color: 'var(--color-error)' }}>{a.old_value ?? '—'}</td>
                        <td style={{ color: 'var(--color-green)' }}>{a.new_value ?? '—'}</td>
                        <td>{a.user_name ?? '—'}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--color-text-muted)' }}>
                          {new Date(a.timestamp).toLocaleString('ar-EG', { timeZone: timezone })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
