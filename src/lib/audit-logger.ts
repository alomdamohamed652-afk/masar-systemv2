import { createServiceClient } from '@/lib/supabase/server'

export interface AuditEntry {
  field: string
  oldValue: unknown
  newValue: unknown
}

export interface AuditPayload {
  userId: string
  userName: string
  entity: string
  entityId: string
  changes: AuditEntry[]
}

/**
 * Compare two objects and return changed fields as AuditEntry[]
 * Usage: diffObjects({ status: 'new', price: 250 }, { status: 'processing', price: 250 })
 * Returns: [{ field: 'status', oldValue: 'new', newValue: 'processing' }]
 */
export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields?: string[]
): AuditEntry[] {
  const keys = fields ?? Object.keys(after)
  const changes: AuditEntry[] = []

  for (const key of keys) {
    const oldVal = before[key]
    const newVal = after[key]
    // Deep-equal check (handles primitives; for objects use JSON.stringify)
    const changed =
      typeof oldVal === 'object' || typeof newVal === 'object'
        ? JSON.stringify(oldVal) !== JSON.stringify(newVal)
        : oldVal !== newVal

    if (changed) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal })
    }
  }

  return changes
}

/**
 * Write audit entries for changed fields
 */
export async function logAudit(payload: AuditPayload) {
  if (!payload.changes.length) return

  try {
    const supabase = createServiceClient()

    const rows = payload.changes.map((c) => ({
      user_id: payload.userId,
      user_name: payload.userName,
      entity: payload.entity,
      entity_id: payload.entityId,
      field: c.field,
      old_value: c.oldValue !== null && c.oldValue !== undefined
        ? String(c.oldValue)
        : null,
      new_value: c.newValue !== null && c.newValue !== undefined
        ? String(c.newValue)
        : null,
      timestamp: new Date().toISOString(),
    }))

    await supabase.from('audit_logs').insert(rows)
  } catch (err) {
    console.error('[logAudit] error:', err)
  }
}
