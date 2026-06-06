'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, EmptyState, LoadingSpinner, Pagination } from '@/components/shared'
import { formatCurrency, ORDER_STATUS_LABELS, ORDER_STATUS_CLASS } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Order, OrderStatus } from '@/types'

const STATUSES = [
  { value: '', label: 'الكل' },
  { value: 'new',           label: 'جديد' },
  { value: 'processing',    label: 'قيد التجهيز' },
  { value: 'ready_to_ship', label: 'جاهز للشحن' },
  { value: 'shipped',       label: 'تم الشحن' },
  { value: 'delivered',     label: 'تم التسليم' },
  { value: 'cancelled',     label: 'ملغي' },
  { value: 'returned',      label: 'مُرتجع' },
]

export default function OrdersPage() {
  const { currency, timezone } = useSettings()
  const [orders, setOrders]   = useState<Order[]>([])
  const [count, setCount]     = useState(0)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res  = await fetch(`/api/orders?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setOrders(json.data ?? [])
      setCount(json.count ?? 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في تحميل الطلبات')
    } finally { setLoading(false) }
  }, [search, status, page])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader
        title="الطلبات"
        subtitle={`${count} طلب`}
        actions={<Link href="/orders/new" className="btn btn-primary">+ طلب جديد</Link>}
      />

      <div className="page-body">
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button key={s.value}
              className={`btn btn-sm ${status === s.value ? 'btn-dark' : 'btn-outline'}`}
              onClick={() => { setStatus(s.value); setPage(1) }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 14 }}>
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            placeholder="بحث برقم الطلب أو اسم العميل أو رقم هاتفه..."
          />
        </div>

        <div className="card">
          {loading ? <LoadingSpinner centered /> : orders.length === 0 ? (
            <EmptyState icon="📦" title="لا توجد طلبات"
              action={<Link href="/orders/new" className="btn btn-primary">+ طلب جديد</Link>} />
          ) : (
            <>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>رقم الطلب</th>
                      <th>العميل</th>
                      <th>الحالة</th>
                      <th>المصدر</th>
                      <th>الإجمالي</th>
                      <th>التاريخ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => {
                      const cust = o.customer as { name: string; phone: string | null } | null
                      return (
                        <tr key={o.id}>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.9rem' }}>
                              {o.order_number}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{cust?.name ?? '—'}</div>
                            {cust?.phone && (
                              <div style={{ fontSize: '.75rem', color: 'var(--text-3)', direction: 'ltr', textAlign: 'right' }}>
                                {cust.phone}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${ORDER_STATUS_CLASS[o.status as OrderStatus]}`}>
                              {ORDER_STATUS_LABELS[o.status as OrderStatus]}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-gray">
                              {o.source === 'wuilt' ? 'Wuilt' : 'يدوي'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--green)' }}>
                            {formatCurrency(o.total, currency)}
                          </td>
                          <td style={{ fontSize: '.8rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                            {new Date(o.created_at).toLocaleDateString('ar-EG', { timeZone: timezone })}
                          </td>
                          <td>
                            <Link href={`/orders/${o.id}`} className="btn btn-ghost btn-sm">عرض</Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={count} pageSize={20} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
