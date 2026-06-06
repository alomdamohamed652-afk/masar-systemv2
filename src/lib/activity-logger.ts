import { createServiceClient } from '@/lib/supabase/server'
import UAParser from 'ua-parser-js'
import type { NextRequest } from 'next/server'

export interface ActivityPayload {
  userId: string
  userName: string
  userRole: string
  action: string
  entity?: string
  entityId?: string
  description?: string
  request?: NextRequest
}

export async function logActivity(payload: ActivityPayload) {
  try {
    const supabase = createServiceClient()

    let ip: string | null = null
    let browser: string | null = null
    let deviceType: string | null = null
    let os: string | null = null

    if (payload.request) {
      // Extract IP
      ip =
        payload.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        payload.request.headers.get('x-real-ip') ??
        null

      // Parse user-agent
      const ua = payload.request.headers.get('user-agent') ?? ''
      const parser = new UAParser(ua)
      const result = parser.getResult()

      browser = result.browser.name
        ? `${result.browser.name} ${result.browser.version ?? ''}`.trim()
        : null

      os = result.os.name
        ? `${result.os.name} ${result.os.version ?? ''}`.trim()
        : null

      // Device type
      const deviceKind = result.device.type
      if (deviceKind === 'mobile') deviceType = 'mobile'
      else if (deviceKind === 'tablet') deviceType = 'tablet'
      else deviceType = 'desktop'
    }

    await supabase.from('activity_logs').insert({
      user_id: payload.userId,
      user_name: payload.userName,
      user_role: payload.userRole,
      action: payload.action,
      entity: payload.entity ?? null,
      entity_id: payload.entityId ?? null,
      description: payload.description ?? null,
      ip_address: ip,
      browser,
      device_type: deviceType,
      os,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    // Never crash the main request due to logging failure
    console.error('[logActivity] error:', err)
  }
}
