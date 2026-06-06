import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'
import { logAudit, diffObjects } from '@/lib/audit-logger'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        images:product_images(id, image_url, sort_order, is_primary),
        variants:product_variants(
          id, color, size, sku_variant,
          stock:warehouse_stocks(
            id, quantity, warehouse_id,
            warehouse:warehouses(id, name)
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    return NextResponse.json({ data, error: null })
  } catch (err: unknown) {
    return NextResponse.json({ error: 'خطأ في تحميل المنتج' }, { status: 500 })
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
    if (!['founder','manager'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }

    // Fetch before for audit
    const { data: before } = await service.from('products').select('*').eq('id', id).single()
    if (!before) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })

    const body = await request.json()
    const { variants, images, ...productData } = body

    const updatePayload: Record<string, unknown> = {}
    const allowedFields = ['name','sku','barcode','internal_code','category_id','supplier','brand','description','cost_price','sell_price']
    for (const f of allowedFields) {
      if (f in productData) updatePayload[f] = productData[f]
    }
    updatePayload.updated_at = new Date().toISOString()

    const { data: updated, error: uErr } = await service
      .from('products').update(updatePayload).eq('id', id).select().single()
    if (uErr) throw uErr

    // Variants: upsert by (product_id, color, size) — NEVER delete existing
    if (variants?.length) {
      for (const v of variants) {
        await service.from('product_variants').upsert({
          product_id:  id,
          color:       v.color || null,
          size:        v.size  || null,
          sku_variant: v.sku_variant || null,
        }, { onConflict: 'product_id,color,size' })
      }
    }

    // Images: replace if provided
    if (images !== undefined) {
      await service.from('product_images').delete().eq('product_id', id)
      if (images.length) {
        await service.from('product_images').insert(
          images.map((img: { image_url: string; sort_order: number; is_primary: boolean }) => ({
            product_id: id,
            image_url:  img.image_url,
            sort_order: img.sort_order ?? 0,
            is_primary: img.is_primary ?? false,
          }))
        )
      }
    }

    // Audit changed fields
    const changes = diffObjects(before, updatePayload as Record<string, unknown>,
      ['name','cost_price','sell_price','category_id','sku','supplier','brand'])
    if (changes.length) {
      await logAudit({
        userId: user.id, userName: profile?.name ?? '',
        entity: 'product', entityId: id, changes,
      })
    }

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'updated', entity: 'product', entityId: id,
      description: `تم تعديل المنتج: ${updated.name}`, request,
    })

    return NextResponse.json({ data: updated, error: null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'خطأ في تعديل المنتج'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    if (profile?.role !== 'founder') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const { data: product } = await service.from('products').select('name').eq('id', id).single()
    await service.from('products').delete().eq('id', id)

    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: 'founder',
      action: 'deleted', entity: 'product', entityId: id,
      description: `تم حذف المنتج: ${product?.name}`, request,
    })

    return NextResponse.json({ data: { id }, error: null })
  } catch (err: unknown) {
    return NextResponse.json({ error: 'خطأ في حذف المنتج' }, { status: 500 })
  }
}
