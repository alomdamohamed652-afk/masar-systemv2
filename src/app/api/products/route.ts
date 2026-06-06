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
    const category = searchParams.get('category') ?? ''
    const page     = parseInt(searchParams.get('page') ?? '1')
    const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
    const from = (page - 1) * pageSize
    const to   = from + pageSize - 1

    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        images:product_images(id, image_url, sort_order, is_primary),
        variants:product_variants(id, color, size, sku_variant)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%,internal_code.ilike.%${search}%`)
    }
    if (category) query = query.eq('category_id', category)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ data, count, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تحميل المنتجات'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    const body = await request.json()
    const { variants, images, ...productData } = body

    // Insert product
    const { data: product, error: pErr } = await service
      .from('products')
      .insert({
        name:          productData.name,
        sku:           productData.sku   || null,
        barcode:       productData.barcode || null,
        internal_code: productData.internal_code || null,
        category_id:   productData.category_id || null,
        supplier:      productData.supplier || null,
        brand:         productData.brand || null,
        description:   productData.description || null,
        cost_price:    Number(productData.cost_price ?? 0),
        sell_price:    Number(productData.sell_price ?? 0),
      })
      .select()
      .single()

    if (pErr) throw pErr

    // Insert variants (upsert by stable composite key)
    if (variants?.length) {
      const variantRows = variants.map((v: { color: string; size: string; sku_variant?: string }) => ({
        product_id:  product.id,
        color:       v.color || null,
        size:        v.size  || null,
        sku_variant: v.sku_variant || null,
      }))
      const { error: vErr } = await service.from('product_variants').insert(variantRows)
      if (vErr) throw vErr
    }

    // Insert images
    if (images?.length) {
      const imgRows = images.map((img: { image_url: string; sort_order: number; is_primary: boolean }) => ({
        product_id: product.id,
        image_url:  img.image_url,
        sort_order: img.sort_order ?? 0,
        is_primary: img.is_primary ?? false,
      }))
      await service.from('product_images').insert(imgRows)
    }

    await logActivity({
      userId: user.id,
      userName: profile?.name ?? '',
      userRole: profile?.role ?? '',
      action: 'created',
      entity: 'product',
      entityId: product.id,
      description: `تم إنشاء المنتج: ${product.name}`,
      request,
    })

    return NextResponse.json({ data: product, error: null }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في إنشاء المنتج'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
