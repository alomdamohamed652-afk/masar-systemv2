'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, EmptyState, LoadingSpinner, Pagination } from '@/components/shared'
import { useSettings } from '@/components/providers/settings-provider'
import type { ActivityLog } from '@/types'

const ENTITIES = ['order','product','customer','inventory','expense','task','salary','leave_request','user','permission','auth','backup','integration','settings']
const ACTIONS  = ['created','updated','deleted','logged_in','whatsapp_sent','inventory_movement','reset_password','backup_created']

export default function ActivityLogsPage() {
  const { timezone } = useSettings()
  const [logs, setLogs]     = useState<ActivityLog[]>([])
  const [count, setCount]   = useState(0)
  const [search, setSearch] = useState('')
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, page: String(page), pageSize: '50' })
      if (entity) params.set('entity', entity)
      if (action) params.set('action', action)
      const res  = await fetch(`/api/activity-logs?${params}`)
      const json = await res.json()
      setLogs(json.data ?? [])
      setCount(json.count ?? 0)
    } catch { toast.error('خطأ في تحميل السجل') }
    finally { setLoading(false) }
  }, [search, entity, action, page])

  useEffect(() => { load() }, [load])

  const ACTION_ICONS: Record<string, string> = {
    created: '✅', updated: '✏️', deleted: '🗑️', logged_in: '🔐',
    whatsapp_sent: '💬', inventory_movement: '📦', reset_password: '🔑',
    backup_created: '💾',
  }

  return (
    <>
      <PageHeader title="سجل النشاط" subtitle={`${count} حدث`} />
      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="بحث بالمستخدم أو الوصف..." />
          <select className="form-select" style={{ width: 150 }} value={entity} onChange={e => { setEntity(e.target.value); setPage(1) }}>
            <option value="">كل الكيانات</option>
            {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select className="form-select" style={{ width: 150 }} value={action} onChange={e => { setAction(e.target.value); setPage(1) }}>
            <option value="">كل الإجراءات</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="card">
          {loading ? <LoadingSpinner centered /> : logs.length === 0 ? (
            <EmptyState icon="📋" title="لا توجد أحداث" />
          ) : (
            <>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr><th>الحدث</th><th>المستخدم</th><th>الكيان</th><th>الجهاز</th><th>التوقيت</th></tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1rem' }}>{ACTION_ICONS[l.action] ?? '🔹'}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{l.action}</div>
                              {l.description && <div style={{ fontSize: '.78rem', color: 'var(--color-text-muted)' }}>{l.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{l.user_name ?? '—'}</div>
                          <div style={{ fontSize: '.75rem', color: 'var(--color-text-muted)' }}>{l.user_role ?? ''}</div>
                        </td>
                        <td>
                          {l.entity && <span className="badge badge-gray">{l.entity}</span>}
                        </td>
                        <td style={{ fontSize: '.78rem', color: 'var(--color-text-muted)' }}>
                          <div>{l.browser ?? '—'}</div>
                          <div>{l.os ?? ''}</div>
                          <div style={{ fontFamily: 'monospace' }}>{l.ip_address ?? ''}</div>
                        </td>
                        <td style={{ fontSize: '.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(l.timestamp).toLocaleString('ar-EG', { timeZone: timezone })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={count} pageSize={50} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  )
}
