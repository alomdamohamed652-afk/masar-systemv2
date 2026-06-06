'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, LoadingSpinner, Modal, FormGrid, ConfirmDialog } from '@/components/shared'
import { ROLE_LABELS } from '@/lib/formatters'
import { useSettings } from '@/components/providers/settings-provider'
import { useAuth } from '@/components/providers/auth-provider'
import type { Profile, Role } from '@/types'

const ROLES: Role[] = ['manager','accountant','customer_service','warehouse','employee']

export default function UsersPage() {
  const { profile: me } = useAuth()
  const { timezone }    = useSettings()
  const [users, setUsers]   = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [resetModal, setResetModal] = useState<Profile | null>(null)
  const [editModal, setEditModal]   = useState<Profile | null>(null)
  const [form, setForm]       = useState({ name: '', email: '', phone: '', password: '', role: 'employee' as Role })
  const [editForm, setEditForm] = useState({ name: '', phone: '', role: 'employee' as Role, is_active: true })
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/users')
    const json = await res.json()
    setUsers(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const createUser = async () => {
    if (!form.email || !form.password) { toast.error('البريد وكلمة المرور مطلوبان'); return }
    if (form.password.length < 8) { toast.error('كلمة المرور 8 أحرف على الأقل'); return }
    setSaving(true)
    try {
      const res  = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم إنشاء المستخدم')
      setModal(false)
      setForm({ name: '', email: '', phone: '', password: '', role: 'employee' })
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ') }
    finally { setSaving(false) }
  }

  const saveEdit = async () => {
    if (!editModal) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/users/${editModal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم التعديل')
      setEditModal(null)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ') }
    finally { setSaving(false) }
  }

  const resetPassword = async () => {
    if (!resetModal || newPassword.length < 8) { toast.error('كلمة المرور 8 أحرف على الأقل'); return }
    setSaving(true)
    try {
      const res  = await fetch(`/api/users/${resetModal.id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_password: newPassword }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('تم إعادة تعيين كلمة المرور')
      setResetModal(null)
      setNewPassword('')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'خطأ') }
    finally { setSaving(false) }
  }

  const openEdit = (u: Profile) => {
    setEditForm({ name: u.name ?? '', phone: u.phone ?? '', role: u.role, is_active: u.is_active })
    setEditModal(u)
  }

  const isFounder = me?.role === 'founder'

  return (
    <>
      <PageHeader
        title="المستخدمون"
        subtitle={`${users.length} مستخدم`}
        actions={isFounder ? <button className="btn btn-primary" onClick={() => setModal(true)}>+ مستخدم جديد</button> : undefined}
      />

      <div className="page-body">
        <div className="card">
          {loading ? <LoadingSpinner centered /> : users.length === 0 ? (
            <EmptyState icon="👤" title="لا يوجد مستخدمون" />
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الهاتف</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>{u.name ?? '—'}</td>
                      <td style={{ direction: 'ltr', textAlign: 'right', fontSize: '.85rem' }}>{u.email ?? '—'}</td>
                      <td style={{ direction: 'ltr', textAlign: 'right', fontSize: '.85rem' }}>{u.phone ?? '—'}</td>
                      <td><span className="badge badge-dark">{ROLE_LABELS[u.role]}</span></td>
                      <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>{u.is_active ? 'نشط' : 'معطّل'}</span></td>
                      <td style={{ fontSize: '.8rem', color: 'var(--color-text-muted)' }}>
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ar-EG', { timeZone: timezone }) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {isFounder && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>تعديل</button>}
                          {isFounder && u.id !== me?.id && <button className="btn btn-ghost btn-sm" onClick={() => setResetModal(u)}>كلمة المرور</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create user modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="مستخدم جديد" size="md"
        footer={<><button className="btn btn-outline" onClick={() => setModal(false)}>إلغاء</button><button className="btn btn-primary" onClick={createUser} disabled={saving}>{saving ? 'جارٍ...' : 'إنشاء'}</button></>}
      >
        <FormGrid cols={2}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">الاسم</label><input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">البريد الإلكتروني <span className="required">*</span></label><input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} dir="ltr" /></div>
          <div className="form-group"><label className="form-label">الهاتف</label><input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
          <div className="form-group">
            <label className="form-label">الدور</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">كلمة المرور <span className="required">*</span></label><input type="password" className="form-input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} dir="ltr" /></div>
        </FormGrid>
      </Modal>

      {/* Edit user modal */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="تعديل المستخدم" size="md"
        footer={<><button className="btn btn-outline" onClick={() => setEditModal(null)}>إلغاء</button><button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'جارٍ...' : 'حفظ'}</button></>}
      >
        <FormGrid cols={2}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">الاسم</label><input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">الهاتف</label><input className="form-input" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
          <div className="form-group">
            <label className="form-label">الدور</label>
            <select className="form-select" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="checkbox" id="active_toggle" checked={editForm.is_active} onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 18, height: 18 }} />
            <label htmlFor="active_toggle" style={{ fontWeight: 600, cursor: 'pointer' }}>حساب نشط</label>
          </div>
        </FormGrid>
      </Modal>

      {/* Reset password modal */}
      <Modal open={!!resetModal} onClose={() => { setResetModal(null); setNewPassword('') }} title={`إعادة تعيين كلمة مرور — ${resetModal?.name}`} size="sm"
        footer={<><button className="btn btn-outline" onClick={() => setResetModal(null)}>إلغاء</button><button className="btn btn-primary" onClick={resetPassword} disabled={saving}>{saving ? 'جارٍ...' : 'تعيين'}</button></>}
      >
        <div className="form-group">
          <label className="form-label">كلمة المرور الجديدة (8 أحرف على الأقل)</label>
          <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} dir="ltr" autoFocus />
        </div>
      </Modal>
    </>
  )
}
