'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, LoadingSpinner } from '@/components/shared'
import { ROLE_LABELS } from '@/lib/formatters'
import type { RolePermissions, Role } from '@/types'

const PERM_LABELS: Record<keyof Omit<RolePermissions, 'id' | 'role' | 'updated_at'>, string> = {
  orders: 'الطلبات', products: 'المنتجات', inventory: 'المخزون',
  customers: 'العملاء', expenses: 'المصروفات', reports: 'التقارير',
  hr: 'الموارد البشرية', settings: 'الإعدادات',
}

const PERM_KEYS = Object.keys(PERM_LABELS) as (keyof typeof PERM_LABELS)[]
const EDITABLE_ROLES: Role[] = ['manager','accountant','customer_service','warehouse','employee']

export default function PermissionsPage() {
  const [perms, setPerms]   = useState<RolePermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/permissions')
    const json = await res.json()
    setPerms(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggle = async (role: Role, field: keyof typeof PERM_LABELS, current: boolean) => {
    setSaving(`${role}.${field}`)
    try {
      const res  = await fetch('/api/permissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, [field]: !current }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setPerms(prev => prev.map(p => p.role === role ? { ...p, [field]: !current } : p))
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ') }
    finally { setSaving(null) }
  }

  if (loading) return <LoadingSpinner centered />

  return (
    <>
      <PageHeader title="الصلاحيات" subtitle="إدارة صلاحيات الأدوار — المؤسس يملك جميع الصلاحيات دائماً" />
      <div className="page-body">
        <div className="card">
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>الصلاحية</th>
                  {EDITABLE_ROLES.map(r => <th key={r} style={{ textAlign: 'center' }}>{ROLE_LABELS[r]}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERM_KEYS.map(field => (
                  <tr key={field}>
                    <td style={{ fontWeight: 600 }}>{PERM_LABELS[field]}</td>
                    {EDITABLE_ROLES.map(role => {
                      const rolePerms = perms.find(p => p.role === role)
                      const value     = rolePerms?.[field] ?? false
                      const isLoading = saving === `${role}.${field}`
                      return (
                        <td key={role} style={{ textAlign: 'center' }}>
                          {isLoading ? (
                            <span className="spinner" style={{ width: 18, height: 18 }} />
                          ) : (
                            <button
                              onClick={() => toggle(role, field, value)}
                              style={{
                                width: 38, height: 22,
                                borderRadius: 99,
                                border: 'none',
                                cursor: 'pointer',
                                background: value ? 'var(--color-green)' : 'var(--color-border)',
                                position: 'relative',
                                transition: 'background .2s',
                              }}
                              title={value ? 'مفعّل — انقر للتعطيل' : 'معطّل — انقر للتفعيل'}
                            >
                              <span style={{
                                position: 'absolute', top: 3,
                                right: value ? 'calc(100% - 16px - 3px)' : 3,
                                width: 16, height: 16,
                                borderRadius: '50%',
                                background: '#fff',
                                transition: 'right .2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                              }} />
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', fontSize: '.82rem', color: 'var(--color-text-muted)' }}>
            التغييرات تُحفظ فوراً عند النقر على المفتاح. سجل التغييرات متاح في صفحة سجل التدقيق.
          </div>
        </div>
      </div>
    </>
  )
}
