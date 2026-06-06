'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { PageHeader, LoadingSpinner, EmptyState } from '@/components/shared'
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/formatters'
import { useAuth } from '@/components/providers/auth-provider'
import { useSettings } from '@/components/providers/settings-provider'
import type { Task, TaskComment, TaskStatus } from '@/types'

const STATUS_CLASS: Record<TaskStatus, string> = {
  open: 'badge-blue', in_progress: 'badge-yellow', done: 'badge-green', cancelled: 'badge-gray',
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { timezone } = useSettings()
  const [task, setTask]         = useState<Task | null>(null)
  const [loading, setLoading]   = useState(true)
  const [comment, setComment]   = useState('')
  const [posting, setPosting]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/tasks/${id}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTask(json.data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'خطأ')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const changeStatus = async (status: TaskStatus) => {
    try {
      const res  = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTask(prev => prev ? { ...prev, status } : prev)
      toast.success('تم تحديث الحالة')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ') }
  }

  const postComment = async () => {
    if (!comment.trim()) return
    setPosting(true)
    try {
      const res  = await fetch(`/api/tasks/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: comment }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setTask(prev => prev ? { ...prev, comments: [...(prev.comments ?? []), json.data] } : prev)
      setComment('')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ') }
    finally { setPosting(false) }
  }

  const uploadAttachment = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('bucket', 'task-attachments')
      const uploadRes  = await fetch('/api/upload', { method: 'POST', body: fd })
      const uploadJson = await uploadRes.json()
      if (uploadJson.error) throw new Error(uploadJson.error)

      const res  = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attachment_url: uploadJson.data.url, attachment_name: file.name }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم رفع المرفق')
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'فشل رفع المرفق') }
    finally { setUploading(false) }
  }

  if (loading) return <LoadingSpinner centered />
  if (!task)   return <EmptyState icon="❌" title="المهمة غير موجودة" />

  const isPrivileged = ['founder','manager'].includes(profile?.role ?? '')
  const isAssignee   = task.assigned_to === profile?.id

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={(task.assignee as { name: string } | null)?.name ? `مكلف إلى: ${(task.assignee as { name: string }).name}` : undefined}
        actions={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={`badge ${STATUS_CLASS[task.status]}`} style={{ fontSize: '.88rem', padding: '6px 12px' }}>{TASK_STATUS_LABELS[task.status]}</span>
            <span className="badge badge-gray" style={{ fontSize: '.88rem', padding: '6px 12px' }}>{TASK_PRIORITY_LABELS[task.priority]}</span>
          </div>
        }
      />

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

          {/* Left: task info + status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-pad">
              <h3 style={{ marginBottom: 12 }}>تفاصيل المهمة</h3>
              {task.description && <p style={{ lineHeight: 1.7, color: 'var(--color-text-secondary)', marginBottom: 14 }}>{task.description}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '.88rem' }}>
                {task.due_date && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>تاريخ الاستحقاق</span>
                    <span style={{ color: new Date(task.due_date) < new Date() && task.status !== 'done' ? 'var(--color-error)' : 'var(--color-text-primary)', fontWeight: 600 }}>
                      {new Date(task.due_date).toLocaleDateString('ar-EG', { timeZone: timezone })}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>أُنشئت</span>
                  <span>{new Date(task.created_at).toLocaleDateString('ar-EG', { timeZone: timezone })}</span>
                </div>
              </div>
            </div>

            {/* Status update */}
            {(isPrivileged || isAssignee) && (
              <div className="card card-pad">
                <h3 style={{ marginBottom: 12 }}>تغيير الحالة</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(['open','in_progress','done','cancelled'] as TaskStatus[]).filter(s => s !== task.status).map(s => (
                    <button key={s} className={`btn ${s === 'done' ? 'btn-primary' : s === 'cancelled' ? 'btn-danger' : 'btn-outline'}`}
                      onClick={() => changeStatus(s)}>
                      {TASK_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3>المرفقات</h3>
                <label style={{ cursor: 'pointer' }}>
                  <span className="btn btn-outline btn-sm">{uploading ? '...' : '+ رفع'}</span>
                  <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadAttachment(e.target.files[0])} />
                </label>
              </div>
              {!task.attachments?.length ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '.85rem' }}>لا توجد مرفقات</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {task.attachments.map(a => (
                    <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--color-bg-subtle)', borderRadius: 8, textDecoration: 'none', color: 'var(--color-text-primary)', fontSize: '.85rem' }}>
                      <span>📎</span> {a.file_name ?? 'مرفق'}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: comments */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-pad" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <h3>التعليقات ({task.comments?.length ?? 0})</h3>
            </div>
            <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 400 }}>
              {!task.comments?.length ? (
                <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0', fontSize: '.88rem' }}>لا توجد تعليقات بعد</p>
              ) : (
                task.comments.map((c: TaskComment) => (
                  <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-dark)', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.8rem', flexShrink: 0 }}>
                      {(c.user as { name: string } | null)?.name?.[0] ?? '؟'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '.85rem' }}>{(c.user as { name: string } | null)?.name ?? 'مستخدم'}</span>
                        <span style={{ fontSize: '.75rem', color: 'var(--color-text-muted)' }}>{new Date(c.created_at).toLocaleString('ar-EG', { timeZone: timezone })}</span>
                      </div>
                      <div style={{ background: 'var(--color-bg-subtle)', borderRadius: '0 10px 10px 10px', padding: '8px 12px', fontSize: '.88rem', lineHeight: 1.6 }}>{c.content}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 10 }}>
              <textarea
                className="form-textarea"
                style={{ flex: 1, minHeight: 60, resize: 'none' }}
                placeholder="اكتب تعليقاً..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
              />
              <button className="btn btn-primary" onClick={postComment} disabled={posting || !comment.trim()} style={{ alignSelf: 'flex-end' }}>
                {posting ? '...' : 'إرسال'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
