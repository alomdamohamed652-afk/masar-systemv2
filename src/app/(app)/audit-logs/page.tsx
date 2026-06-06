'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingSpinner, Pagination } from '@/components/shared'
import { useSettings } from '@/components/providers/settings-provider'
import type { AuditLog } from '@/types'

const ENTITIES = ['order','product','customer','user','permission','task','salary','leave_request']

export default function AuditLogsPage() {
  const { timezone } = useSettings()
  const [logs, setLogs]     = useState<AuditLog[]>([])
  const [count, setCount]   = useState(0)
  const [entity, setEntity] = useState('')
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (entity) params.set('entity', entity)
      const res  = await fetch(`/api/audit-logs?${params}`)
      const json = await res.json()
      setLogs(json.data ?? [])
      setCount(json.count ?? 0)
    } catch { toast.error('خطأ في تحميل سجل التدقيق') }
    finally { setLoading(false) }
  }, [entity, page])

  useEffect(() => { load() }, [load])

  return (
    <>
      <PageHeader title="سجل التدقيق" subtitle={`${count} تغيير`} />
      <div className="page-body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 180 }} value={entity} onChange={e => { setEntity(e.target.value); setPage(1) }}>
            <option value="">كل الكيانات</option>
            {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="card">
          {loading ? <LoadingSpinner centered /> : logs.length === 0 ? (
            <EmptyState icon="🔍" title="لا توجد تغييرات مسجلة" />
          ) : (
            <>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr><th>الكيان</th><th>الحقل</th><th>القيمة القديمة</th><th>القيمة الجديدة</th><th>المستخدم</th><th>التوقيت</th></tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td><span className="badge badge-gray">{l.entity}</span></td>
                        <td><code style={{ fontSize: '.82rem', background: 'var(--color-bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>{l.field}</code></td>
                        <td style={{ color: 'var(--color-error)', fontWeight: 500 }}>{l.old_value ?? <em style={{ opacity: .5 }}>فارغ</em>}</td>
                        <td style={{ color: 'var(--color-green)', fontWeight: 500 }}>{l.new_value ?? <em style={{ opacity: .5 }}>فارغ</em>}</td>
                        <td style={{ fontWeight: 600, fontSize: '.88rem' }}>{l.user_name ?? '—'}</td>
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
