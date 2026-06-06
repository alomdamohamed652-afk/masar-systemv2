'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSettings } from '@/components/providers/settings-provider'
import { formatCurrency, ORDER_STATUS_LABELS, ORDER_STATUS_CLASS } from '@/lib/formatters'
import type { DatePeriod, OrderStatus } from '@/types'

const PERIODS: { value: DatePeriod; label: string }[] = [
  { value: 'today',   label: 'اليوم' },
  { value: 'week',    label: 'الأسبوع' },
  { value: 'month',   label: 'الشهر' },
  { value: '3months', label: '3 أشهر' },
  { value: '6months', label: '6 أشهر' },
  { value: 'year',    label: 'السنة' },
  { value: 'custom',  label: 'مخصص' },
]

interface DashStats {
  total_orders: number; total_revenue: number; total_expenses: number; net_profit: number
  orders_by_status: Record<string, number>
  top_products: { product_id: string; name: string; total_sold: number; revenue: number }[]
  top_customers: { customer_id: string; name: string; order_count: number; total_spent: number }[]
  low_stock: { name: string; color: string | null; size: string | null; quantity: number; warehouse: string }[]
}

export default function DashboardPage() {
  const { currency, timezone } = useSettings()
  const [period, setPeriod]   = useState<DatePeriod>('month')
  const [customFrom, setFrom] = useState('')
  const [customTo,   setTo]   = useState('')
  const [stats, setStats]     = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ period })
      if (period === 'custom' && customFrom) p.set('from', customFrom)
      if (period === 'custom' && customTo)   p.set('to',   customTo)
      const res  = await fetch(`/api/dashboard?${p}`)
      const json = await res.json()
      if (json.data) setStats(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [period, customFrom, customTo])

  useEffect(() => {
    if (period !== 'custom') load()
    else if (customFrom && customTo) load()
  }, [period, customFrom, customTo, load])

  const fmt = (n: number) => formatCurrency(n, currency)

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>لوحة التحكم</h1>
          <p style={{ marginTop: 4, fontSize: '.85rem' }}>نظرة عامة على أداء العلامة التجارية</p>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button key={p.value} className={`btn btn-sm ${period === p.value ? 'btn-dark' : 'btn-outline'}`} onClick={() => setPeriod(p.value)}>{p.label}</button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div style={{ padding: '0 28px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="form-input" style={{ width: 160 }} value={customFrom} onChange={e => setFrom(e.target.value)} />
          <span style={{ color: 'var(--color-text-muted)' }}>إلى</span>
          <input type="date" className="form-input" style={{ width: 160 }} value={customTo} onChange={e => setTo(e.target.value)} />
        </div>
      )}

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : !stats ? (
          <div className="empty-state"><p>تعذّر تحميل البيانات</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {[
                { label: 'إجمالي الطلبات',  value: String(stats.total_orders) },
                { label: 'إجمالي الإيرادات', value: fmt(stats.total_revenue),  positive: true },
                { label: 'إجمالي المصروفات', value: fmt(stats.total_expenses), negative: true },
                { label: 'صافي الربح',       value: fmt(stats.net_profit),     positive: stats.net_profit >= 0, negative: stats.net_profit < 0 },
              ].map(c => (
                <div key={c.label} className="stat-card">
                  <div className="stat-label">{c.label}</div>
                  <div className={`stat-value ${c.positive ? 'positive' : ''} ${c.negative ? 'negative' : ''}`}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Orders by status */}
            {Object.keys(stats.orders_by_status).length > 0 && (
              <div className="card card-pad">
                <h3 style={{ marginBottom: 14 }}>الطلبات حسب الحالة</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {Object.entries(stats.orders_by_status).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 20px', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', minWidth: 100 }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{count}</span>
                      <span className={`badge ${ORDER_STATUS_CLASS[status as OrderStatus]}`} style={{ marginTop: 6 }}>{ORDER_STATUS_LABELS[status as OrderStatus]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top products + Top customers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <div className="card">
                <div className="card-pad" style={{ borderBottom: '1px solid var(--color-border)' }}><h3>أفضل المنتجات</h3></div>
                {stats.top_products.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '.88rem' }}>لا توجد بيانات</div>
                ) : stats.top_products.slice(0, 7).map((p, i) => (
                  <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < 6 ? '1px solid var(--color-border)' : 'none' }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? 'var(--color-green)' : 'var(--color-bg-subtle)', color: i === 0 ? '#fff' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '.88rem' }}>{p.name}</span>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <div style={{ fontSize: '.8rem', color: 'var(--color-text-muted)' }}>{p.total_sold} وحدة</div>
                      <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--color-green)' }}>{fmt(p.revenue)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-pad" style={{ borderBottom: '1px solid var(--color-border)' }}><h3>أفضل العملاء</h3></div>
                {stats.top_customers.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '.88rem' }}>لا توجد بيانات</div>
                ) : stats.top_customers.slice(0, 7).map((c, i) => (
                  <div key={c.customer_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: i < 6 ? '1px solid var(--color-border)' : 'none' }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? 'var(--color-green)' : 'var(--color-bg-subtle)', color: i === 0 ? '#fff' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '.88rem' }}>{c.name}</span>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <div style={{ fontSize: '.8rem', color: 'var(--color-text-muted)' }}>{c.order_count} طلب</div>
                      <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--color-green)' }}>{fmt(c.total_spent)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Low stock alert */}
            {stats.low_stock.length > 0 && (
              <div className="card">
                <div className="card-pad" style={{ borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3>⚠️ تحذير: مخزون منخفض</h3>
                  <span className="badge badge-red">{stats.low_stock.length}</span>
                </div>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>المستودع</th><th>الكمية</th></tr></thead>
                    <tbody>
                      {stats.low_stock.map((s, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td>{s.color ?? '—'}</td>
                          <td>{s.size ?? '—'}</td>
                          <td>{s.warehouse}</td>
                          <td><span className="badge badge-red">{s.quantity}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  )
}
