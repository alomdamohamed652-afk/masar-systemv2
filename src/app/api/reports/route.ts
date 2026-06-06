import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPeriodRange } from '@/lib/timezone'
import type { DatePeriod } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type   = searchParams.get('type') ?? 'top_products'
    const period = (searchParams.get('period') ?? 'month') as DatePeriod
    const customFrom = searchParams.get('from') ?? undefined
    const customTo   = searchParams.get('to')   ?? undefined

    const service = createServiceClient()
    const { data: settings } = await service.from('settings').select('timezone').single()
    const tz = settings?.timezone ?? 'Africa/Cairo'
    const { from, to } = getPeriodRange(period, tz, customFrom, customTo)

    let result: unknown = null

    switch (type) {
      case 'top_products': {
        const { data: items } = await service
          .from('order_items')
          .select('product_id, quantity, total_price, products(name, sku)')
          .gte('created_at', from).lte('created_at', to)

        const map: Record<string, { name: string; sku: string; qty: number; revenue: number }> = {}
        for (const i of (items ?? [])) {
          if (!i.product_id) continue
          const p = i.products as unknown as { name: string; sku: string } | null
          if (!map[i.product_id]) map[i.product_id] = { name: p?.name ?? '—', sku: p?.sku ?? '—', qty: 0, revenue: 0 }
          map[i.product_id].qty     += i.quantity
          map[i.product_id].revenue += Number(i.total_price)
        }
        result = Object.entries(map)
          .map(([id, v]) => ({ product_id: id, ...v }))
          .sort((a, b) => b.qty - a.qty)
        break
      }

      case 'top_colors': {
        const { data: items } = await service
          .from('order_items')
          .select('color, quantity')
          .gte('created_at', from).lte('created_at', to)
          .not('color', 'is', null)

        const map: Record<string, number> = {}
        for (const i of (items ?? [])) { map[i.color!] = (map[i.color!] ?? 0) + i.quantity }
        result = Object.entries(map)
          .map(([color, qty]) => ({ color, qty }))
          .sort((a, b) => b.qty - a.qty)
        break
      }

      case 'top_sizes': {
        const { data: items } = await service
          .from('order_items')
          .select('size, quantity')
          .gte('created_at', from).lte('created_at', to)
          .not('size', 'is', null)

        const map: Record<string, number> = {}
        for (const i of (items ?? [])) { map[i.size!] = (map[i.size!] ?? 0) + i.quantity }
        result = Object.entries(map)
          .map(([size, qty]) => ({ size, qty }))
          .sort((a, b) => b.qty - a.qty)
        break
      }

      case 'top_customers': {
        const { data: orders } = await service
          .from('orders')
          .select('customer_id, total, customers(name, phone)')
          .gte('created_at', from).lte('created_at', to)
          .neq('status', 'cancelled')

        const map: Record<string, { name: string; phone: string | null; count: number; total: number }> = {}
        for (const o of (orders ?? [])) {
          if (!o.customer_id) continue
          const c = o.customers as unknown as { name: string; phone: string | null } | null
          if (!map[o.customer_id]) map[o.customer_id] = { name: c?.name ?? '—', phone: c?.phone ?? null, count: 0, total: 0 }
          map[o.customer_id].count++
          map[o.customer_id].total += Number(o.total)
        }
        result = Object.entries(map)
          .map(([id, v]) => ({ customer_id: id, ...v }))
          .sort((a, b) => b.total - a.total)
        break
      }

      case 'inventory_value': {
        const { data: stocks } = await service
          .from('warehouse_stocks')
          .select(`
            quantity,
            warehouses(name),
            products(name, cost_price, sell_price),
            variant:product_variants(color, size)
          `)
          .gt('quantity', 0)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = (stocks ?? []).map((s: any) => ({
          warehouse:   s.warehouses?.name ?? '—',
          product:     s.products?.name ?? '—',
          color:       s.variant?.color ?? null,
          size:        s.variant?.size  ?? null,
          quantity:    s.quantity,
          cost_value:  s.quantity * Number(s.products?.cost_price ?? 0),
          sell_value:  s.quantity * Number(s.products?.sell_price ?? 0),
        }))
        break
      }

      case 'low_stock': {
        const { data: settings2 } = await service.from('settings').select('low_stock_threshold').single()
        const threshold = settings2?.low_stock_threshold ?? 10
        const { data: stocks } = await service
          .from('warehouse_stocks')
          .select(`
            quantity,
            warehouses(name),
            products(name, sku),
            variant:product_variants(color, size)
          `)
          .lt('quantity', threshold)
          .gte('quantity', 0)

        result = stocks
        break
      }

      default:
        return NextResponse.json({ error: 'نوع التقرير غير معروف' }, { status: 400 })
    }

    return NextResponse.json({ data: result, period: { from, to }, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تحميل التقرير'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
