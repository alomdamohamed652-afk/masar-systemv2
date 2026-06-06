'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: string
  permission?: 'orders'|'products'|'inventory'|'customers'|'expenses'|'reports'|'hr'|'settings'
}

const NAV: NavItem[] = [
  { href: '/dashboard',      label: 'لوحة التحكم',      icon: '◈' },
  { href: '/orders',         label: 'الطلبات',          icon: '📦', permission: 'orders' },
  { href: '/products',       label: 'المنتجات',         icon: '👕', permission: 'products' },
  { href: '/inventory',      label: 'المخزون',          icon: '🏪', permission: 'inventory' },
  { href: '/warehouses',     label: 'المستودعات',       icon: '🏭', permission: 'inventory' },
  { href: '/customers',      label: 'العملاء',          icon: '👥', permission: 'customers' },
  { href: '/expenses',       label: 'المصروفات',        icon: '💳', permission: 'expenses' },
  { href: '/reports',        label: 'التقارير',         icon: '📊', permission: 'reports' },
  { href: '/tasks',          label: 'المهام',           icon: '✓' },
  { href: '/salaries',       label: 'الرواتب',          icon: '💰', permission: 'hr' },
  { href: '/leave-requests', label: 'طلبات الإجازة',    icon: '📅', permission: 'hr' },
  { href: '/users',          label: 'المستخدمون',       icon: '👤', permission: 'settings' },
  { href: '/permissions',    label: 'الصلاحيات',        icon: '🔐', permission: 'settings' },
  { href: '/activity-logs',  label: 'سجل النشاط',       icon: '📋', permission: 'settings' },
  { href: '/audit-logs',     label: 'سجل التدقيق',      icon: '🔍', permission: 'settings' },
  { href: '/integrations',   label: 'التكاملات',        icon: '🔗', permission: 'settings' },
  { href: '/backups',        label: 'النسخ الاحتياطية', icon: '💾', permission: 'settings' },
  { href: '/settings',       label: 'الإعدادات',        icon: '⚙',  permission: 'settings' },
]

const ROLE_LABELS: Record<string, string> = {
  founder: 'المؤسس', manager: 'مدير', accountant: 'محاسب',
  customer_service: 'خدمة عملاء', warehouse: 'مستودع', employee: 'موظف',
}

interface Props {
  mobileOpen?: boolean
  onClose?: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Sidebar({ mobileOpen, onClose, theme, onToggleTheme }: Props) {
  const pathname        = usePathname()
  const { profile, can, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [badges, setBadges]         = useState({ orders: 0, leaves: 0 })
  const supabase = createClient()

  // Load notification badges
  const loadBadges = useCallback(async () => {
    if (!profile) return
    try {
      const [o, l] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      setBadges({ orders: o.count ?? 0, leaves: l.count ?? 0 })
    } catch { /* silent */ }
  }, [profile, supabase])

  useEffect(() => {
    loadBadges()
    const interval = setInterval(loadBadges, 60_000)
    return () => clearInterval(interval)
  }, [loadBadges])

  const handleSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      // signOut does window.location.replace so this is a fallback
      window.location.replace('/login')
    }
  }, [signOut, signingOut])

  const getBadge = (href: string): number => {
    if (href === '/orders')         return badges.orders
    if (href === '/leave-requests') return badges.leaves
    return 0
  }

  const visible = NAV.filter(item => !item.permission || can(item.permission))

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.55)',
            zIndex: 199,
            WebkitTapHighlightColor: 'transparent',
          }}
        />
      )}

      <aside
        className="sidebar"
        style={{
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
      >
        {/* Brand */}
        <div style={{
          padding: '22px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,.07)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#F7F6E5', letterSpacing: '4px' }}>
            MASAR
          </div>
          <div style={{ fontSize: '.68rem', color: '#4a5568', marginTop: 3, letterSpacing: '.4px' }}>
            نظام إدارة العلامة التجارية
          </div>
        </div>

        {/* User info */}
        {profile && (
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '.9rem', color: '#fff', flexShrink: 0,
            }}>
              {profile.name?.[0]?.toUpperCase() ?? '؟'}
            </div>
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '.87rem', fontWeight: 700, color: '#F7F6E5',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {profile.name ?? '—'}
              </div>
              <div style={{ fontSize: '.69rem', color: '#4a5568' }}>
                {ROLE_LABELS[profile.role] ?? profile.role}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          {visible.map(item => {
            const active = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))
            const badge = getBadge(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 9, marginBottom: 2,
                  fontSize: '.86rem', fontWeight: active ? 700 : 500,
                  color: active ? '#F7F6E5' : '#6b7b8f',
                  background: active ? 'var(--green)' : 'transparent',
                  transition: 'background .12s, color .12s',
                  textDecoration: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: '.92rem', flexShrink: 0, position: 'relative', lineHeight: 1 }}>
                  {item.icon}
                  {badge > 0 && (
                    <span style={{
                      position: 'absolute', top: -5, left: -8,
                      minWidth: 16, height: 16,
                      background: '#e53e3e', color: '#fff',
                      borderRadius: 99, fontSize: '.6rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px',
                      border: '1.5px solid var(--dark)',
                    }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{
          padding: '10px',
          borderTop: '1px solid rgba(255,255,255,.06)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '9px 12px', borderRadius: 9,
              background: 'none', border: 'none',
              cursor: 'pointer', color: '#6b7b8f',
              fontSize: '.85rem', fontWeight: 500,
              fontFamily: 'Cairo, sans-serif',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span>{theme === 'dark' ? '☀' : '🌙'}</span>
            <span>{theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
          </button>

          {/* Sign out - always visible, always works */}
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '11px 12px', borderRadius: 9,
              background: signingOut ? 'rgba(184,50,50,.08)' : 'rgba(184,50,50,.18)',
              border: '1px solid rgba(184,50,50,.25)',
              cursor: signingOut ? 'wait' : 'pointer',
              color: '#f08080',
              fontSize: '.88rem', fontWeight: 700,
              fontFamily: 'Cairo, sans-serif',
              transition: 'background .15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {signingOut ? (
              <><span className="spinner" style={{ width: 14, height: 14 }} /> جارٍ الخروج...</>
            ) : (
              <><span style={{ fontSize: '1rem' }}>⬅</span> تسجيل الخروج</>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
