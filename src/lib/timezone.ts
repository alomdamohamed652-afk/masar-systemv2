import { format, parseISO } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

// Default fallback if settings not loaded
const DEFAULT_TZ = 'Africa/Cairo'

/**
 * Format a UTC ISO string using the system timezone from settings
 */
export function formatTz(
  isoString: string | null | undefined,
  fmt: string = 'dd/MM/yyyy HH:mm',
  timezone: string = DEFAULT_TZ
): string {
  if (!isoString) return '—'
  try {
    return formatInTimeZone(new Date(isoString), timezone, fmt)
  } catch {
    return '—'
  }
}

/**
 * Format date only (no time)
 */
export function formatDate(
  isoString: string | null | undefined,
  timezone: string = DEFAULT_TZ
): string {
  return formatTz(isoString, 'dd/MM/yyyy', timezone)
}

/**
 * Format time only
 */
export function formatTime(
  isoString: string | null | undefined,
  timezone: string = DEFAULT_TZ
): string {
  return formatTz(isoString, 'HH:mm', timezone)
}

/**
 * Get start/end UTC ISO strings for a named period
 * Used for dashboard and report filters
 */
export function getPeriodRange(
  period: 'today' | 'week' | 'month' | '3months' | '6months' | 'year' | 'custom',
  timezone: string = DEFAULT_TZ,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date()

  // Build "now" in the target timezone
  const zonedNow = toZonedTime(now, timezone)

  // Helper: start of day in target tz → UTC
  const startOfDayUtc = (d: Date) => {
    const s = new Date(d)
    s.setHours(0, 0, 0, 0)
    return s.toISOString()
  }

  const endOfDayUtc = () => {
    const e = new Date(zonedNow)
    e.setHours(23, 59, 59, 999)
    return e.toISOString()
  }

  switch (period) {
    case 'today': {
      return { from: startOfDayUtc(zonedNow), to: endOfDayUtc() }
    }
    case 'week': {
      const d = new Date(zonedNow)
      d.setDate(d.getDate() - 6)
      return { from: startOfDayUtc(d), to: endOfDayUtc() }
    }
    case 'month': {
      const d = new Date(zonedNow)
      d.setDate(d.getDate() - 29)
      return { from: startOfDayUtc(d), to: endOfDayUtc() }
    }
    case '3months': {
      const d = new Date(zonedNow)
      d.setMonth(d.getMonth() - 3)
      return { from: startOfDayUtc(d), to: endOfDayUtc() }
    }
    case '6months': {
      const d = new Date(zonedNow)
      d.setMonth(d.getMonth() - 6)
      return { from: startOfDayUtc(d), to: endOfDayUtc() }
    }
    case 'year': {
      const d = new Date(zonedNow)
      d.setFullYear(d.getFullYear() - 1)
      return { from: startOfDayUtc(d), to: endOfDayUtc() }
    }
    case 'custom': {
      return {
        from: customFrom ?? startOfDayUtc(zonedNow),
        to: customTo ?? endOfDayUtc(),
      }
    }
    default:
      return { from: startOfDayUtc(zonedNow), to: endOfDayUtc() }
  }
}

/**
 * Format a month DATE value (2025-01-01) to display string
 */
export function formatMonth(isoDate: string): string {
  try {
    return format(parseISO(isoDate), 'MMMM yyyy')
  } catch {
    return isoDate
  }
}

/**
 * Get first day of month for salary filtering
 * Input: '2025-01' → '2025-01-01'
 */
export function toMonthStart(yearMonth: string): string {
  return `${yearMonth}-01`
}

/**
 * Available timezones for settings dropdown
 */
export const TIMEZONES = [
  { value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2/+3)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (AST, UTC+3)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)' },
  { value: 'Asia/Kuwait', label: 'Kuwait (AST, UTC+3)' },
  { value: 'Asia/Beirut', label: 'Beirut (EET, UTC+2/+3)' },
  { value: 'Africa/Tunis', label: 'Tunis (CET, UTC+1)' },
  { value: 'Africa/Casablanca', label: 'Casablanca (WET, UTC+0/+1)' },
  { value: 'Europe/London', label: 'London (GMT/BST, UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (CET, UTC+1/+2)' },
  { value: 'America/New_York', label: 'New York (EST/EDT, UTC-5/-4)' },
  { value: 'UTC', label: 'UTC' },
]
