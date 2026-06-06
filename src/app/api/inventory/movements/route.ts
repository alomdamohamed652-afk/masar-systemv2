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
    const warehouseId = searchParams.get('warehouse_id')
    const productId   = searchParams.get('product_id')
    const type        = searchParams.get('type')
    const page        = parseInt(searchParams.get('page') ?? '1')
    const pageSize    = parseInt(searchParams.get('pageSize') ?? '50')
    const fromIdx = (page - 1) * pageSize
    const toIdx   = fromIdx + pageSize - 1

    let query = supabase
      .from('inventory_movements')
      .select(`
        *,
        warehouse:warehouses(id, name),
        product:products(id, name, sku),
        variant:product_variants(id, color, size),
        creator:profiles(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx)

    if (warehouseId) query = query.eq('warehouse_id', warehouseId)
    if (productId)   query = query.eq('product_id', productId)
    if (type)        query = query.eq('movement_type', type)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ data, count, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل حركات المخزون' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager','warehouse'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    const { warehouse_id, product_id, variant_id, movement_type, quantity, notes, reference_id,
            to_warehouse_id } = body

    if (!warehouse_id)    return NextResponse.json({ error: 'يرجى تحديد المستودع' },    { status: 400 })
    if (!product_id)      return NextResponse.json({ error: 'يرجى تحديد المنتج' },      { status: 400 })
    if (!variant_id)      return NextResponse.json({ error: 'يرجى تحديد المتغير' },     { status: 400 })
    if (!movement_type)   return NextResponse.json({ error: 'يرجى تحديد نوع الحركة' }, { status: 400 })
    if (!quantity || quantity === 0) return NextResponse.json({ error: 'يرجى ادخال الكمية' }, { status: 400 })

    // For warehouse_transfer, to_warehouse_id is required
    if (movement_type === 'warehouse_transfer' && !to_warehouse_id) {
      return NextResponse.json({ error: 'يرجى تحديد المستودع المستقبل' }, { status: 400 })
    }

    const finalQty = ['remove','damaged'].includes(movement_type)
      ? -Math.abs(quantity)
      : Math.abs(quantity)

    // Check stock won't go negative
    if (finalQty < 0 || movement_type === 'warehouse_transfer') {
      const { data: stock } = await service
        .from('warehouse_stocks')
        .select('quantity')
        .eq('warehouse_id', warehouse_id)
        .eq('variant_id', variant_id)
        .single()

      const current = stock?.quantity ?? 0
      const needed  = Math.abs(quantity)
      if (current < needed) {
        return NextResponse.json({
          error: `الكمية المتاحة في المستودع هي ${current} فقط`,
        }, { status: 400 })
      }
    }

    // Insert outgoing movement
    const { data: movement, error: mErr } = await service
      .from('inventory_movements')
      .insert({
        warehouse_id,
        product_id,
        variant_id,
        movement_type,
        quantity: finalQty,
        notes:        notes || null,
        reference_id: reference_id || null,
        created_by:   user.id,
      })
      .select()
      .single()
    if (mErr) throw mErr

    // For warehouse_transfer: insert incoming movement to target warehouse
    if (movement_type === 'warehouse_transfer' && to_warehouse_id) {
      await service.from('inventory_movements').insert({
        warehouse_id:  to_warehouse_id,
        product_id,
        variant_id,
        movement_type: 'add',
        quantity:      Math.abs(quantity),
        notes:         `نقل من مستودع آخر${notes ? ` — ${notes}` : ''}`,
        reference_id:  movement.id,
        created_by:    user.id,
      })
    }

    const { data: variant } = await service.from('product_variants').select('color,size').eq('id', variant_id).single()
    const { data: product } = await service.from('products').select('name').eq('id', product_id).single()

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'inventory_movement', entity: 'inventory', entityId: movement.id,
      description: `${movement_type} — ${product?.name} (${variant?.color ?? ''} ${variant?.size ?? ''}) x${Math.abs(finalQty)}`,
      request,
    })

    return NextResponse.json({ data: movement, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تسجيل حركة المخزون'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
