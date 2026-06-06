import type { OrderStatus, MovementType, Role, TaskPriority, TaskStatus, LeaveStatus } from '@/types'

// ── Currency ──────────────────────────────────────────────
export function formatCurrency(amount: number | null | undefined, currency = 'EGP'): string {
  if (amount === null || amount === undefined) return '—'
  return `${Number(amount).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('ar-EG')
}

// ── Order status ─────────────────────────────────────────
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new:           'جديد',
  processing:    'قيد التجهيز',
  ready_to_ship: 'جاهز للشحن',
  shipped:       'تم الشحن',
  delivered:     'تم التسليم',
  cancelled:     'ملغي',
  returned:      'مُرتجع',
}

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  new:           'status-new',
  processing:    'status-processing',
  ready_to_ship: 'status-ready_to_ship',
  shipped:       'status-shipped',
  delivered:     'status-delivered',
  cancelled:     'status-cancelled',
  returned:      'status-returned',
}

// ── Movement type ─────────────────────────────────────────
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  add:                'إضافة مخزون',
  remove:             'سحب مخزون',
  adjustment:         'تسوية',
  damaged:            'تالف',
  customer_return:    'مرتجع من عميل',
  warehouse_transfer: 'نقل بين مستودعين',
}

// ── Role labels ───────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  founder:          'المؤسس',
  manager:          'مدير',
  accountant:       'محاسب',
  customer_service: 'خدمة عملاء',
  warehouse:        'مستودع',
  employee:         'موظف',
}

// ── Task labels ───────────────────────────────────────────
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    'منخفضة',
  medium: 'متوسطة',
  high:   'عالية',
  urgent: 'عاجلة',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open:        'مفتوحة',
  in_progress: 'قيد التنفيذ',
  done:        'منجزة',
  cancelled:   'ملغاة',
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending:  'قيد المراجعة',
  approved: 'مقبولة',
  rejected: 'مرفوضة',
}

// ── Variant display ───────────────────────────────────────
export function formatVariant(color: string | null, size: string | null): string {
  const parts = [color, size].filter(Boolean)
  return parts.length ? parts.join(' / ') : '—'
}

// ── File size ─────────────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
