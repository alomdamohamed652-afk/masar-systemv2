'use client'

import { useEffect, useRef } from 'react'

// ── Modal ─────────────────────────────────────────────────
interface ModalProps {
  open: boolean; onClose: () => void; title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode; footer?: React.ReactNode
}

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ fontSize: '1rem', color: 'var(--text-3)', lineHeight: 1 }}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────
export function ConfirmDialog({ open, title, message, confirmLabel = 'تأكيد', danger = false, loading = false, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string
  danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-header"><h3 style={{ fontWeight: 700 }}>{title}</h3></div>
        <div className="modal-body">
          <p style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>إلغاء</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> جارٍ...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────
export function EmptyState({ icon = '📭', title, description, action }: {
  icon?: string; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>{icon}</div>
      <h3 style={{ fontWeight: 600, color: 'var(--text-2)' }}>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

// ── Loading Spinner ───────────────────────────────────────
export function LoadingSpinner({ size = 24, centered = false }: { size?: number; centered?: boolean }) {
  const el = <span className="spinner" style={{ width: size, height: size }} />
  if (!centered) return el
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>{el}</div>
  )
}

// ── Page Header ───────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p style={{ marginTop: 3, fontSize: '.84rem', color: 'var(--text-3)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}

// ── Search Input ──────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'بحث...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', right: 12, color: 'var(--text-3)', fontSize: '.88rem', pointerEvents: 'none' }}>🔍</span>
      <input type="text" className="form-input" style={{ paddingRight: 36, minWidth: 240 }}
        placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

// ── Form Grid ─────────────────────────────────────────────
export function FormGrid({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px 20px' }}>
      {children}
    </div>
  )
}

// ── Section Title ─────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '.74rem', fontWeight: 700, color: 'var(--text-3)',
      textTransform: 'uppercase', letterSpacing: '.07em',
      marginBottom: 14, paddingBottom: 8,
      borderBottom: '1px solid var(--border)',
    }}>{children}</div>
  )
}

// ── Pagination ────────────────────────────────────────────
export function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderTop: '1px solid var(--border)',
      fontSize: '.85rem', color: 'var(--text-3)', flexWrap: 'wrap', gap: 8,
    }}>
      <span>{Math.min((page-1)*pageSize+1, total)}–{Math.min(page*pageSize, total)} من {total.toLocaleString('ar-EG')}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => onChange(page-1)}>السابق</button>
        {pages.map(p => (
          <button key={p} className={`btn btn-sm ${p === page ? 'btn-dark' : 'btn-outline'}`} onClick={() => onChange(p)}>{p}</button>
        ))}
        <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => onChange(page+1)}>التالي</button>
      </div>
    </div>
  )
}

// ── Tag Input ─────────────────────────────────────────────
export function TagInput({ tags, onChange, suggestions = [], placeholder = 'أضف وسماً...' }: {
  tags: string[]; onChange: (t: string[]) => void; suggestions?: string[]; placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const add = (tag: string) => { const t = tag.trim(); if (t && !tags.includes(t)) onChange([...tags, t]) }
  const remove = (t: string) => onChange(tags.filter(x => x !== t))
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['Enter',',','Tab'].includes(e.key)) {
      e.preventDefault()
      const v = (e.target as HTMLInputElement).value
      if (v) { add(v); (e.target as HTMLInputElement).value = '' }
    }
    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && tags.length) remove(tags[tags.length-1])
  }
  return (
    <div>
      <div onClick={() => inputRef.current?.focus()} style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, padding: '7px 10px',
        border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)',
        background: 'var(--bg-card)', cursor: 'text', minHeight: 44,
      }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', background: 'var(--dark)', color: 'var(--bg)', borderRadius: 99, fontSize: '.76rem', fontWeight: 700 }}>
            {t}
            <button type="button" onClick={e => { e.stopPropagation(); remove(t) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '.72rem', padding: 0, lineHeight: 1 }}>✕</button>
          </span>
        ))}
        <input ref={inputRef} type="text" placeholder={tags.length === 0 ? placeholder : ''} onKeyDown={onKey}
          style={{ border: 'none', outline: 'none', flex: 1, minWidth: 80, fontSize: '.88rem', fontFamily: 'Cairo, sans-serif', background: 'transparent', color: 'var(--text-1)' }} />
      </div>
      {suggestions.filter(s => !tags.includes(s)).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {suggestions.filter(s => !tags.includes(s)).map(s => (
            <button key={s} type="button" onClick={() => add(s)} style={{ padding: '2px 10px', border: '1px solid var(--border)', borderRadius: 99, background: 'transparent', fontSize: '.74rem', cursor: 'pointer', fontFamily: 'Cairo, sans-serif', color: 'var(--text-2)' }}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  )
}
