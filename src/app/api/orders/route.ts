import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search   = searchParams.get('search') ?? ''
    const status   = searchParams.get('status') ?? ''
    const source   = searchParams.get('source') ?? ''
    const dateFrom = searchParams.get('from') ?? ''
    const dateTo   = searchParams.get('to') ?? ''
    const page     = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
    const fromIdx  = (page - 1) * pageSize
    const toIdx    = fromIdx + pageSize - 1

    // Enhanced search: order number, customer name, customer phone
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, status, source, total, created_at, updated_at,
        tracking_number, shipping_company, shipping_cost,
        customer:customers(id, name, phone)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx)

    if (status)   query = query.eq('status', status)
    if (source)   query = query.eq('source', source)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo)   query = query.lte('created_at', dateTo)

    // Search by order number only in orders table
    // Customer name/phone search handled client-side via customer join
    if (search) {
      query = query.ilike('order_number', `%${search}%`)
    }

    const { data: orders, error, count } = await query
    if (error) throw error

    // If search term looks like a name/phone, also search by customer
    if (search && !/^MS\d/i.test(search)) {
      // Get customer IDs matching the search
      const { data: matchingCustomers } = await supabase
        .from('customers')
        .select('id')
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)

      if (matchingCustomers?.length) {
        const customerIds = matchingCustomers.map(c => c.id)
        const { data: customerOrders, count: cCount } = await supabase
          .from('orders')
          .select(`
            id, order_number, status, source, total, created_at, updated_at,
            tracking_number, shipping_company, shipping_cost,
            customer:customers(id, name, phone)
          `, { count: 'exact' })
          .in('customer_id', customerIds)
          .order('created_at', { ascending: false })
          .range(fromIdx, toIdx)

        // Merge results deduped by id
        const merged = [...(orders ?? []), ...(customerOrders ?? [])]
        const seen   = new Set<string>()
        const deduped = merged.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })
        return NextResponse.json({ data: deduped, count: (count ?? 0) + (cCount ?? 0), error: null })
      }
    }

    return NextResponse.json({ data: orders, count, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تحميل الطلبات'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager','customer_service'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    const { items, new_customer, customer_id, ...orderData } = body

    if (!items?.length) {
      return NextResponse.json({ error: 'يرجى اضافة منتج واحد على الاقل' }, { status: 400 })
    }

    // Resolve or create customer
    let resolvedCustomerId = customer_id
    if (!resolvedCustomerId && new_customer?.name) {
      const { data: created } = await service.from('customers').insert({
        name:        new_customer.name.trim(),
        phone:       new_customer.phone || null,
        email:       new_customer.email || null,
        address:     new_customer.address || null,
        governorate: new_customer.governorate || null,
      }).select('id').single()
      resolvedCustomerId = created?.id
    }

    // Generate order number
    const { data: numRow } = await service.rpc('generate_order_number')
    const orderNumber = numRow || `MS${Date.now()}`

    const subtotal     = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + (i.quantity * i.unit_price), 0)
    const discount     = Number(orderData.discount    ?? 0)
    const shippingCost = Number(orderData.shipping_cost ?? 0)
    const taxRate      = Number(orderData.tax          ?? 0)
    const taxAmt       = (subtotal - discount) * (taxRate / 100)
    const total        = subtotal - discount + taxAmt + shippingCost

    const { data: order, error: oErr } = await service.from('orders').insert({
      order_number:     orderNumber,
      customer_id:      resolvedCustomerId || null,
      status:           'new',
      source:           orderData.source || 'manual',
      external_id:      orderData.external_id || null,
      shipping_company: orderData.shipping_company || null,
      tracking_number:  orderData.tracking_number  || null,
      shipping_cost:    shippingCost,
      internal_notes:   orderData.internal_notes   || null,
      customer_notes:   orderData.customer_notes   || null,
      subtotal,
      discount,
      tax:   taxAmt,
      total,
      created_by: user.id,
    }).select().single()
    if (oErr) throw oErr

    const orderItems = items.map((i: {
      product_id: string; variant_id: string; color?: string; size?: string;
      quantity: number; unit_price: number
    }) => ({
      order_id:    order.id,
      product_id:  i.product_id,
      variant_id:  i.variant_id || null,
      color:       i.color || null,
      size:        i.size  || null,
      quantity:    i.quantity,
      unit_price:  i.unit_price,
      total_price: i.quantity * i.unit_price,
    }))

    const { error: iErr } = await service.from('order_items').insert(orderItems)
    if (iErr) throw iErr

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'created', entity: 'order', entityId: order.id,
      description: `تم انشاء الطلب: ${orderNumber}`, request,
    })

    return NextResponse.json({ data: order, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في انشاء الطلب'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
