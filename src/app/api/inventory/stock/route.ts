import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get('warehouse_id')
    const productId   = searchParams.get('product_id')

    let query = supabase
      .from('warehouse_stocks')
      .select(`
        id, quantity, updated_at,
        warehouse:warehouses(id, name),
        product:products(id, name, sku),
        variant:product_variants(id, color, size, sku_variant)
      `)
      .order('updated_at', { ascending: false })

    if (warehouseId) query = query.eq('warehouse_id', warehouseId)
    if (productId)   query = query.eq('product_id', productId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في تحميل المخزون' }, { status: 500 })
  }
}
