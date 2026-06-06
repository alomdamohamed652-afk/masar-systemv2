import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { logAudit } from '@/lib/audit-logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(*),
        items:order_items(
          *,
          product:products(id, name, sku),
          variant:product_variants(id, color, size)
        ),
        creator:profiles(id, name)
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل الطلب' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager','customer_service'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const { data: before } = await service.from('orders').select('*').eq('id', id).single()
    if (!before) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

    const body = await request.json()
    const allowedFields = ['status','shipping_company','tracking_number','shipping_cost','internal_notes','customer_notes','discount']
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const f of allowedFields) {
      if (f in body) update[f] = body[f]
    }

    // Deduct inventory when status changes to 'processing'
    if (body.status === 'processing' && before.status !== 'processing') {
      const { data: items } = await service
        .from('order_items').select('product_id, variant_id, quantity').eq('order_id', id)
      const { data: warehouse } = await service
        .from('warehouses').select('id').eq('is_active', true).order('created_at').limit(1).single()

      if (warehouse && items?.length) {
        for (const item of items) {
          if (!item.variant_id) continue
          await service.from('inventory_movements').insert({
            warehouse_id:  warehouse.id,
            product_id:    item.product_id,
            variant_id:    item.variant_id,
            movement_type: 'remove',
            quantity:      -Math.abs(item.quantity),
            reference_id:  id,
            notes:         `خصم تلقائي للطلب ${before.order_number}`,
            created_by:    user.id,
          })
        }
      }
    }

    // Restore inventory when status changes to 'returned'
    if (body.status === 'returned' && !['returned','cancelled'].includes(before.status)) {
      const { data: items } = await service
        .from('order_items').select('product_id, variant_id, quantity').eq('order_id', id)
      const { data: warehouse } = await service
        .from('warehouses').select('id').eq('is_active', true).order('created_at').limit(1).single()

      if (warehouse && items?.length) {
        for (const item of items) {
          if (!item.variant_id) continue
          await service.from('inventory_movements').insert({
            warehouse_id:  warehouse.id,
            product_id:    item.product_id,
            variant_id:    item.variant_id,
            movement_type: 'customer_return',
            quantity:      Math.abs(item.quantity),
            reference_id:  id,
            notes:         `ارتجاع تلقائي للطلب ${before.order_number}`,
            created_by:    user.id,
          })
        }
      }
    }

    const { data: updated, error: uErr } = await service
      .from('orders').update(update).eq('id', id).select().single()
    if (uErr) throw uErr

    if (body.status && body.status !== before.status) {
      await logAudit({
        userId: user.id, userName: profile?.name ?? '',
        entity: 'order', entityId: id,
        changes: [{ field: 'status', oldValue: before.status, newValue: body.status }],
      })
    }

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'updated', entity: 'order', entityId: id,
      description: `تعديل الطلب ${before.order_number}${body.status ? ` → ${body.status}` : ''}`,
      request,
    })

    return NextResponse.json({ data: updated, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تعديل الطلب'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
