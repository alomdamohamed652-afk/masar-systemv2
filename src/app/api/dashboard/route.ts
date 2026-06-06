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
    const period = (searchParams.get('period') ?? 'month') as DatePeriod
    const customFrom = searchParams.get('from') ?? undefined
    const customTo   = searchParams.get('to')   ?? undefined

    // Get timezone from settings
    const service = createServiceClient()
    const { data: settings } = await service
      .from('settings')
      .select('timezone, low_stock_threshold')
      .single()

    const timezone = settings?.timezone ?? 'Africa/Cairo'
    const lowStockThreshold = settings?.low_stock_threshold ?? 10
    const { from, to } = getPeriodRange(period, timezone, customFrom, customTo)

    // ── All queries in parallel ──────────────────────────────

    const [ordersRes, expensesRes, topProductsRes, topCustomersRes, lowStockRes] =
      await Promise.all([

        // Orders + revenue for period
        service
          .from('orders')
          .select('id, status, total')
          .gte('created_at', from)
          .lte('created_at', to)
          .neq('status', 'cancelled'),

        // Expenses for period
        service
          .from('expenses')
          .select('amount')
          .gte('created_at', from)
          .lte('created_at', to),

        // Top products by quantity sold
        service
          .from('order_items')
          .select('product_id, quantity, total_price, products(name)')
          .gte('created_at', from)
          .lte('created_at', to),

        // Top customers by order count + total
        service
          .from('orders')
          .select('customer_id, total, customers(name)')
          .gte('created_at', from)
          .lte('created_at', to)
          .neq('status', 'cancelled'),

        // Low stock from snapshot table
        service
          .from('warehouse_stocks')
          .select(`
            id, quantity,
            warehouses(name),
            products(name),
            product_variants(color, size)
          `)
          .lt('quantity', lowStockThreshold)
          .gt('quantity', -1),
      ])

    const orders   = ordersRes.data   ?? []
    const expenses = expensesRes.data ?? []

    // Aggregate orders
    const totalOrders  = orders.length
    const totalRevenue = orders.reduce((s: number, o: { total: number }) => s + Number(o.total), 0)
    const totalExpenses = expenses.reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0)
    const netProfit    = totalRevenue - totalExpenses

    const ordersByStatus: Record<string, number> = {}
    for (const o of orders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1
    }

    // Aggregate top products
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    for (const item of (topProductsRes.data ?? [])) {
      if (!item.product_id) continue
      const name = (item.products as any)?.name ?? 'منتج محذوف'
      if (!productMap[item.product_id]) {
        productMap[item.product_id] = { name, qty: 0, revenue: 0 }
      }
      productMap[item.product_id].qty     += item.quantity
      productMap[item.product_id].revenue += Number(item.total_price)
    }

    const topProducts = Object.entries(productMap)
      .map(([id, v]) => ({ product_id: id, name: v.name, total_sold: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 10)

    // Aggregate top customers
    const customerMap: Record<string, { name: string; count: number; total: number }> = {}
    for (const o of (topCustomersRes.data ?? [])) {
      if (!o.customer_id) continue
      const name = (o.customers as any)?.name ?? 'عميل محذوف'
      if (!customerMap[o.customer_id]) {
        customerMap[o.customer_id] = { name, count: 0, total: 0 }
      }
      customerMap[o.customer_id].count++
      customerMap[o.customer_id].total += Number(o.total)
    }

    const topCustomers = Object.entries(customerMap)
      .map(([id, v]) => ({ customer_id: id, name: v.name, order_count: v.count, total_spent: v.total }))
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, 10)

    // Low stock
    const lowStock = (lowStockRes.data ?? []).map((s: any) => ({
      stock_id:   s.id,
      product_id: s.product_id,
      name:       s.products?.name ?? '—',
      color:      s.product_variants?.color ?? null,
      size:       s.product_variants?.size  ?? null,
      quantity:   s.quantity,
      warehouse:  s.warehouses?.name ?? '—',
    }))

    return NextResponse.json({
      data: {
        total_orders:   totalOrders,
        total_revenue:  totalRevenue,
        total_expenses: totalExpenses,
        net_profit:     netProfit,
        orders_by_status: ordersByStatus,
        top_products:   topProducts,
        top_customers:  topCustomers,
        low_stock:      lowStock,
        period:         { from, to },
      },
      error: null,
    })
  } catch (err) {
    console.error('[dashboard/stats]', err)
    return NextResponse.json({ data: null, error: 'خطأ في تحميل الإحصائيات' }, { status: 500 })
  }
}
