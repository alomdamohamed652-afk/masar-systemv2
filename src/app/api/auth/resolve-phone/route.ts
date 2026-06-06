import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()
    if (!phone) {
      return NextResponse.json({ email: null }, { status: 400 })
    }

    // Normalize phone: remove spaces, convert 00xx → +xx
    const normalized = String(phone)
      .replace(/\s+/g, '')
      .replace(/^00/, '+')

    const supabase = createServiceClient()

    // Try exact match first, then with +20 prefix for Egyptian numbers
    const variants = [normalized]
    if (/^0\d{9,10}$/.test(normalized)) {
      // Local Egyptian number like 01012345678 → try +201012345678
      variants.push('+2' + normalized)
    }

    for (const variant of variants) {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone', variant)
        .single()

      if (data?.email) {
        return NextResponse.json({ email: data.email })
      }
    }

    return NextResponse.json({ email: null })
  } catch {
    return NextResponse.json({ email: null }, { status: 500 })
  }
}
