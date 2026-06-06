import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity-logger'

// No emojis - clean Arabic text only
const MESSAGES: Record<string, (d: { customerName: string; orderNumber: string; tracking?: string }) => string> = {
  new: ({ customerName, orderNumber }) =>
    `مرحبا ${customerName}\n\nتم استلام طلبك رقم *${orderNumber}* بنجاح.\nسنقوم بتجهيزه في اقرب وقت.\n\nشكرا لاختيارك MASAR`,

  processing: ({ customerName, orderNumber }) =>
    `مرحبا ${customerName}\n\nطلبك رقم *${orderNumber}* قيد التجهيز الان.\nسيتم اشعارك عند الشحن.\n\nشكرا لاختيارك MASAR`,

  ready_to_ship: ({ customerName, orderNumber }) =>
    `مرحبا ${customerName}\n\nطلبك رقم *${orderNumber}* جاهز للشحن.\nسيتم تسليمه الى شركة الشحن قريبا.\n\nشكرا لاختيارك MASAR`,

  shipped: ({ customerName, orderNumber, tracking }) =>
    `مرحبا ${customerName}\n\nتم شحن طلبك رقم *${orderNumber}*${tracking ? `\n\nرقم التتبع: *${tracking}*` : ''}\n\nشكرا لاختيارك MASAR`,

  delivered: ({ customerName, orderNumber }) =>
    `مرحبا ${customerName}\n\nتم توصيل طلبك رقم *${orderNumber}* بنجاح.\n\nنشكرك على ثقتك في MASAR\nنامل ان تكون راضيا عن طلبك`,

  cancelled: ({ customerName, orderNumber }) =>
    `مرحبا ${customerName}\n\nنأسف لابلاغك ان طلبك رقم *${orderNumber}* تم الغاؤه.\nللاستفسار يرجى التواصل معنا.\n\nشكرا لاختيارك MASAR`,

  returned: ({ customerName, orderNumber }) =>
    `مرحبا ${customerName}\n\nتم استلام مرتجع طلبك رقم *${orderNumber}*.\nللاستفسار يرجى التواصل معنا.\n\nشكرا لاختيارك MASAR`,
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()
    const { data: order } = await service
      .from('orders')
      .select('order_number, status, tracking_number, customer:customers(name, phone)')
      .eq('id', id)
      .single()

    if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })

    const customer = order.customer as unknown as { name: string; phone: string | null } | null
    const rawPhone = customer?.phone?.replace(/\D/g, '')
    if (!rawPhone) return NextResponse.json({ error: 'لا يوجد رقم هاتف للعميل' }, { status: 400 })

    const messageFn = MESSAGES[order.status] ?? MESSAGES['new']
    const message = messageFn({
      customerName: customer?.name ?? 'عزيزي العميل',
      orderNumber:  order.order_number,
      tracking:     order.tracking_number ?? undefined,
    })

    // Normalize to international format
    let intlPhone = rawPhone
    if (intlPhone.startsWith('0')) intlPhone = '2' + intlPhone

    const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`

    const { data: profile } = await service.from('profiles').select('name,role').eq('id', user.id).single()
    await logActivity({
      userId: user.id, userName: profile?.name ?? '', userRole: profile?.role ?? '',
      action: 'whatsapp_sent', entity: 'order', entityId: id,
      description: `واتساب للطلب ${order.order_number} (${order.status})`,
      request,
    })

    return NextResponse.json({ data: { url: waUrl, message }, error: null })
  } catch {
    return NextResponse.json({ error: 'خطأ في انشاء رسالة واتساب' }, { status: 500 })
  }
}
