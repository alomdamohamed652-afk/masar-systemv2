'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, EmptyState, LoadingSpinner, Pagination } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import type { Product, Category } from '@/types'

export default function ProductsPage() {
  const { currency } = useSettings()
  const [products, setProducts]   = useState<Product[]>([])
  const [count, setCount]         = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('')
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, page: String(page), pageSize: '20' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/products?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setProducts(json.data ?? [])
      setCount(json.count ?? 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ في تحميل المنتجات')
    } finally {
      setLoading(false)
    }
  }, [search, category, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(j => setCategories(j.data ?? []))
  }, [])

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle={`${count} منتج`}
        actions={
          <Link href="/products/new" className="btn btn-primary">+ منتج جديد</Link>
        }
      />

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="بحث بالاسم أو SKU أو باركود..." />
          <select
            className="form-select"
            style={{ width: 180 }}
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1) }}
          >
            <option value="">كل الفئات</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="card">
          {loading ? <LoadingSpinner centered /> : products.length === 0 ? (
            <EmptyState icon="👕" title="لا توجد منتجات" description="أضف أول منتج للبدء" action={<Link href="/products/new" className="btn btn-primary">+ منتج جديد</Link>} />
          ) : (
            <>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>الصورة</th>
                      <th>الاسم</th>
                      <th>SKU</th>
                      <th>الفئة</th>
                      <th>سعر التكلفة</th>
                      <th>سعر البيع</th>
                      <th>المتغيرات</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const primary = p.images?.find(i => i.is_primary) ?? p.images?.[0]
                      return (
                        <tr key={p.id}>
                          <td>
                            {primary ? (
                              <img src={primary.image_url} alt={p.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)' }} />
                            ) : (
                              <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--color-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>👕</div>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '.8rem', color: 'var(--color-text-muted)' }}>{p.sku ?? '—'}</td>
                          <td>{p.category?.name ?? '—'}</td>
                          <td>{formatCurrency(p.cost_price, currency)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>{formatCurrency(p.sell_price, currency)}</td>
                          <td><span className="badge badge-gray">{p.variants?.length ?? 0} متغير</span></td>
                          <td>
                            <Link href={`/products/${p.id}`} className="btn btn-ghost btn-sm">تعديل</Link>
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
