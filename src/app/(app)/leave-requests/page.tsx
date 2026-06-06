'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingSpinner, Modal, ConfirmDialog } from '@/components/shared'
import { LEAVE_STATUS_LABELS } from '@/lib/formatters'
import { useAuth } from '@/components/providers/auth-provider'
import { useSettings } from '@/components/providers/settings-provider'
import type { LeaveRequest, LeaveStatus } from '@/types'

const LEAVE_TYPES = [{ value: 'annual', label: 'إجازة سنوية' }, { value: 'sick', label: 'إجازة مرضية' }, { value: 'unpaid', label: 'إجازة بدون راتب' }, { value: 'other', label: 'أخرى' }]
const STATUS_CLASS: Record<LeaveStatus, string> = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' }

export default function LeaveRequestsPage() {
  const { profile } = useAuth()
  const { timezone } = useSettings()
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusF, setStatusF]   = useState('')
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ type: 'annual', start_date: '', end_date: '', reason: '' })
  const [saving, setSaving]     = useState(false)
  const [confirm, setConfirm]   = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null)

  const isPrivileged = ['founder','manager'].includes(profile?.role ?? '')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusF) params.set('status', statusF)
      const res  = await fetch(`/api/leaves?${params}`)
      const json = await res.json()
      setRequests(json.data ?? [])
    } catch { toast.error('خطأ في تحميل الطلبات') }
    finally { setLoading(false) }
  }, [statusF])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.start_date || !form.end_date) { toast.error('يرجى تحديد تواريخ الإجازة'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/leaves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم إرسال طلب الإجازة')
      setModal(false)
      setForm({ type: 'annual', start_date: '', end_date: '', reason: '' })
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    } finally { setSaving(false) }
  }

  const review = async () => {
    if (!confirm) return
    try {
      const res  = await fetch(`/api/leaves/${confirm.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: confirm.status }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(confirm.status === 'approved' ? 'تم قبول الطلب' : 'تم رفض الطلب')
      setConfirm(null)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ') }
  }

  const days = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <>
      <PageHeader
        title="طلبات الإجازة"
        actions={<button className="btn btn-primary" onClick={() => setModal(true)}>+ طلب إجازة</button>}
      />

      <div className="page-body">
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['', 'pending', 'approved', 'rejected'] as const).map(s => (
            <button key={s} className={`btn btn-sm ${statusF === s ? 'btn-dark' : 'btn-outline'}`} onClick={() => setStatusF(s)}>
              {s === '' ? 'الكل' : LEAVE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {loading ? <LoadingSpinner centered /> : requests.length === 0 ? (
          <EmptyState icon="📅" title="لا توجد طلبات إجازة" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map(r => {
              const user     = r.user as { name: string } | null
              const reviewer = r.reviewer as { name: string } | null
              return (
                <div key={r.id} className="card card-pad">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.name ?? '—'}</div>
                      <div style={{ fontSize: '.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        {LEAVE_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                        {' · '}
                        {new Date(r.start_date).toLocaleDateString('ar-EG')} — {new Date(r.end_date).toLocaleDateString('ar-EG')}
                        {' · '}{days(r.start_date, r.end_date)} يوم
                      </div>
                      {r.reason && <div style={{ marginTop: 6, fontSize: '.85rem', color: 'var(--color-text-secondary)' }}>{r.reason}</div>}
                      {reviewer && r.reviewed_at && (
                        <div style={{ marginTop: 4, fontSize: '.78rem', color: 'var(--color-text-muted)' }}>
                          راجعه: {reviewer.name} — {new Date(r.reviewed_at).toLocaleDateString('ar-EG', { timeZone: timezone })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <span className={`badge ${STATUS_CLASS[r.status]}`}>{LEAVE_STATUS_LABELS[r.status]}</span>
                      {isPrivileged && r.status === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => setConfirm({ id: r.id, status: 'approved' })}>قبول</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ id: r.id, status: 'rejected' })}>رفض</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="طلب إجازة جديد" size="sm"
        footer={<><button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'جارٍ...' : 'إرسال الطلب'}</button></>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">نوع الإجازة</label>
            <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">من <span className="required">*</span></label><input type="date" className="form-input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">إلى <span className="required">*</span></label><input type="date" className="form-input" value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          </div>
          {form.start_date && form.end_date && (
            <div style={{ padding: '8px 12px', background: 'var(--color-info-bg)', borderRadius: 8, fontSize: '.85rem', color: 'var(--color-info)' }}>
              المدة: {days(form.start_date, form.end_date)} يوم
            </div>
          )}
          <div className="form-group"><label className="form-label">السبب</label><textarea className="form-textarea" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.status === 'approved' ? 'قبول طلب الإجازة' : 'رفض طلب الإجازة'}
        message={`هل تريد ${confirm?.status === 'approved' ? 'قبول' : 'رفض'} هذا الطلب؟`}
        confirmLabel="تأكيد"
        danger={confirm?.status === 'rejected'}
        onConfirm={review}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
