'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingSpinner } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { DatePeriod } from '@/types'

const REPORT_TYPES = [
  { value: 'top_products',    label: 'أفضل المنتجات' },
  { value: 'top_colors',      label: 'أفضل الألوان' },
  { value: 'top_sizes',       label: 'أفضل المقاسات' },
  { value: 'top_customers',   label: 'أفضل العملاء' },
  { value: 'inventory_value', label: 'قيمة المخزون' },
  { value: 'low_stock',       label: 'مخزون منخفض' },
]

const PERIODS: { value: DatePeriod; label: string }[] = [
  { value: 'today', label: 'اليوم' }, { value: 'week', label: 'أسبوع' }, { value: 'month', label: 'شهر' },
  { value: '3months', label: '3 أشهر' }, { value: '6months', label: '6 أشهر' }, { value: 'year', label: 'سنة' },
]

export default function ReportsPage() {
  const { currency } = useSettings()
  const [reportType, setReportType] = useState('top_products')
  const [period, setPeriod]         = useState<DatePeriod>('month')
  const [data, setData]             = useState<unknown[]>([])
  const [loading, setLoading]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/reports?type=${reportType}&period=${period}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json.data ?? [])
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ في التقرير') }
    finally { setLoading(false) }
  }, [reportType, period])

  useEffect(() => { load() }, [load])

  const fmt = (n: number) => formatCurrency(n, currency)

  return (
    <>
      <PageHeader title="التقارير" />
      <div className="page-body">
        {/* Report type tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {REPORT_TYPES.map(r => (
            <button key={r.value} className={`btn btn-sm ${reportType === r.value ? 'btn-dark' : 'btn-outline'}`} onClick={() => setReportType(r.value)}>{r.label}</button>
          ))}
        </div>

        {/* Period filter (not shown for inventory reports) */}
        {!['inventory_value','low_stock'].includes(reportType) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.value} className={`btn btn-sm ${period === p.value ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPeriod(p.value)}>{p.label}</button>
            ))}
          </div>
        )}

        <div className="card">
          {loading ? <LoadingSpinner centered /> : data.length === 0 ? (
            <EmptyState icon="📊" title="لا توجد بيانات" description="لا توجد بيانات كافية لهذا التقرير في الفترة المحددة" />
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              {reportType === 'top_products' && (
                <table>
                  <thead><tr><th>#</th><th>المنتج</th><th>الوحدات المباعة</th><th>الإيرادات</th></tr></thead>
                  <tbody>
                    {(data as { product_id: string; name: string; qty: number; revenue: number }[]).map((r, i) => (
                      <tr key={r.product_id}>
                        <td><span style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? 'var(--color-green)' : 'var(--color-bg-subtle)', color: i === 0 ? '#fff' : 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.78rem' }}>{i+1}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td>{r.qty} وحدة</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-green)' }}>{fmt(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'top_colors' && (
                <table>
                  <thead><tr><th>#</th><th>اللون</th><th>الوحدات المباعة</th></tr></thead>
                  <tbody>
                    {(data as { color: string; qty: number }[]).map((r, i) => (
                      <tr key={r.color}><td>{i+1}</td><td style={{ fontWeight: 600 }}>{r.color}</td><td>{r.qty}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'top_sizes' && (
                <table>
                  <thead><tr><th>#</th><th>المقاس</th><th>الوحدات المباعة</th></tr></thead>
                  <tbody>
                    {(data as { size: string; qty: number }[]).map((r, i) => (
                      <tr key={r.size}><td>{i+1}</td><td style={{ fontWeight: 600 }}>{r.size}</td><td>{r.qty}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'top_customers' && (
                <table>
                  <thead><tr><th>#</th><th>العميل</th><th>الهاتف</th><th>عدد الطلبات</th><th>إجمالي الإنفاق</th></tr></thead>
                  <tbody>
                    {(data as { customer_id: string; name: string; phone: string | null; count: number; total: number }[]).map((r, i) => (
                      <tr key={r.customer_id}><td>{i+1}</td><td style={{ fontWeight: 600 }}>{r.name}</td><td style={{ direction: 'ltr', textAlign: 'right' }}>{r.phone ?? '—'}</td><td>{r.count}</td><td style={{ fontWeight: 700, color: 'var(--color-green)' }}>{fmt(r.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === 'inventory_value' && (
                <>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 20 }}>
                    <div><span style={{ color: 'var(--color-text-muted)', fontSize: '.85rem' }}>قيمة التكلفة: </span><strong style={{ color: 'var(--color-text-primary)' }}>{fmt((data as { cost_value: number }[]).reduce((s, r) => s + r.cost_value, 0))}</strong></div>
                    <div><span style={{ color: 'var(--color-text-muted)', fontSize: '.85rem' }}>قيمة البيع: </span><strong style={{ color: 'var(--color-green)' }}>{fmt((data as { sell_value: number }[]).reduce((s, r) => s + r.sell_value, 0))}</strong></div>
                  </div>
                  <table>
                    <thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>المستودع</th><th>الكمية</th><th>قيمة التكلفة</th><th>قيمة البيع</th></tr></thead>
                    <tbody>
                      {(data as { product: string; color: string | null; size: string | null; warehouse: string; quantity: number; cost_value: number; sell_value: number }[]).map((r, i) => (
                        <tr key={i}><td style={{ fontWeight: 600 }}>{r.product}</td><td>{r.color ?? '—'}</td><td>{r.size ?? '—'}</td><td>{r.warehouse}</td><td>{r.quantity}</td><td>{fmt(r.cost_value)}</td><td style={{ color: 'var(--color-green)', fontWeight: 600 }}>{fmt(r.sell_value)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {reportType === 'low_stock' && (
                <table>
                  <thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>المستودع</th><th>الكمية</th></tr></thead>
                  <tbody>
                    {(data as { products: { name: string } | null; variant: { color: string | null; size: string | null } | null; warehouses: { name: string } | null; quantity: number }[]).map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.products?.name ?? '—'}</td>
                        <td>{r.variant?.color ?? '—'}</td>
                        <td>{r.variant?.size ?? '—'}</td>
                        <td>{r.warehouses?.name ?? '—'}</td>
                        <td><span className="badge badge-red">{r.quantity}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
