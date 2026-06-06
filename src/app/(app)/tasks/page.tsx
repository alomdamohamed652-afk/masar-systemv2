'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PageHeader, SearchInput, EmptyState, LoadingSpinner, Modal, FormGrid } from '@/components/shared'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/formatters'
import { useAuth } from '@/components/providers/auth-provider'
import { useSettings } from '@/components/providers/settings-provider'
import type { Task, TaskPriority, TaskStatus } from '@/types'

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  low: 'badge-gray', medium: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red',
}
const STATUS_CLASS: Record<TaskStatus, string> = {
  open: 'badge-blue', in_progress: 'badge-yellow', done: 'badge-green', cancelled: 'badge-gray',
}

export default function TasksPage() {
  const { profile } = useAuth()
  const { timezone } = useSettings()
  const [tasks, setTasks]     = useState<Task[]>([])
  const [count, setCount]     = useState(0)
  const [statusF, setStatusF] = useState('')
  const [priorityF, setPriorityF] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [users, setUsers]     = useState<{ id: string; name: string }[]>([])
  const [form, setForm]       = useState({ title: '', description: '', assigned_to: '', priority: 'medium' as TaskPriority, due_date: '' })
  const [saving, setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '50' })
      if (statusF)   params.set('status', statusF)
      if (priorityF) params.set('priority', priorityF)
      const res  = await fetch(`/api/tasks?${params}`)
      const json = await res.json()
      setTasks(json.data ?? [])
      setCount(json.count ?? 0)
    } catch { toast.error('خطأ في تحميل المهام') }
    finally { setLoading(false) }
  }, [statusF, priorityF])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (['founder','manager'].includes(profile?.role ?? '')) {
      fetch('/api/users').then(r => r.json()).then(j => setUsers(j.data ?? []))
    }
  }, [profile])

  const save = async () => {
    if (!form.title.trim()) { toast.error('عنوان المهمة مطلوب'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم إنشاء المهمة')
      setModal(false)
      setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    } finally { setSaving(false) }
  }

  const isPrivileged = ['founder', 'manager'].includes(profile?.role ?? '')

  return (
    <>
      <PageHeader
        title="المهام"
        subtitle={`${count} مهمة`}
        actions={isPrivileged ? <button className="btn btn-primary" onClick={() => setModal(true)}>+ مهمة جديدة</button> : undefined}
      />

      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['', 'open', 'in_progress', 'done', 'cancelled'] as const).map(s => (
            <button key={s} className={`btn btn-sm ${statusF === s ? 'btn-dark' : 'btn-outline'}`}
              onClick={() => setStatusF(s)}>
              {s === '' ? 'الكل' : TASK_STATUS_LABELS[s]}
            </button>
          ))}
          <div style={{ width: 1, background: 'var(--color-border)', margin: '0 4px' }} />
          {(['', 'urgent', 'high', 'medium', 'low'] as const).map(p => (
            <button key={p} className={`btn btn-sm ${priorityF === p ? 'btn-dark' : 'btn-outline'}`}
              onClick={() => setPriorityF(p)}>
              {p === '' ? 'كل الأولويات' : TASK_PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>

        {loading ? <LoadingSpinner centered /> : tasks.length === 0 ? (
          <EmptyState icon="✅" title="لا توجد مهام" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.map(t => (
              <Link key={t.id} href={`/tasks/${t.id}`} style={{ textDecoration: 'none' }}>
                <div className="card card-pad" style={{ cursor: 'pointer', transition: 'box-shadow .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4, color: 'var(--color-text-primary)' }}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: '.83rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                          {t.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className={`badge ${STATUS_CLASS[t.status]}`}>{TASK_STATUS_LABELS[t.status]}</span>
                        <span className={`badge ${PRIORITY_CLASS[t.priority]}`}>{TASK_PRIORITY_LABELS[t.priority]}</span>
                        {(t.assignee as { name: string } | null) && (
                          <span style={{ fontSize: '.78rem', color: 'var(--color-text-muted)' }}>
                            👤 {(t.assignee as { name: string }).name}
                          </span>
                        )}
                        {t.due_date && (
                          <span style={{ fontSize: '.78rem', color: new Date(t.due_date) < new Date() ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                            📅 {new Date(t.due_date).toLocaleDateString('ar-EG', { timeZone: timezone })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="مهمة جديدة" size="md"
        footer={<><button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'جارٍ...' : 'إنشاء'}</button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label className="form-label">العنوان <span className="required">*</span></label><input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus /></div>
          <div className="form-group"><label className="form-label">الوصف</label><textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <FormGrid cols={2}>
            <div className="form-group">
              <label className="form-label">الأولوية</label>
              <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}>
                {(['low','medium','high','urgent'] as TaskPriority[]).map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">تاريخ الاستحقاق</label><input className="form-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            {users.length > 0 && (
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">الموظف المكلف</label>
                <select className="form-select" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                  <option value="">غير محدد</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
          </FormGrid>
        </div>
      </Modal>
    </>
  )
}
