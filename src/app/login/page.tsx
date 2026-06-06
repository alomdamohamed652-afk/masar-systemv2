'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const supabase = createClient()

  // Apply saved theme on login page too
  useEffect(() => {
    const saved = localStorage.getItem('masar-theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) { toast.error('يرجى إدخال البريد الإلكتروني أو رقم الهاتف'); return }
    if (!password)           { toast.error('يرجى إدخال كلمة المرور'); return }

    setLoading(true)
    try {
      let email = identifier.trim().toLowerCase()

      // Phone number → resolve to email
      if (!email.includes('@')) {
        const res  = await fetch('/api/auth/resolve-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: email }),
        })
        const json = await res.json()
        if (!json.email) {
          toast.error('رقم الهاتف غير مسجل في النظام')
          return
        }
        email = json.email
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        if (error.message.toLowerCase().includes('invalid login')) {
          toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة')
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('الحساب غير مفعّل — تواصل مع المؤسس')
        } else {
          toast.error('حدث خطأ أثناء تسجيل الدخول')
          console.error(error)
        }
        return
      }

      // Log the login
      fetch('/api/auth/log-login', { method: 'POST' }).catch(() => {})

      window.location.replace('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100svh',
      background: 'var(--dark)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            fontSize: 'clamp(2rem, 8vw, 2.8rem)',
            fontWeight: 900,
            color: '#F7F6E5',
            letterSpacing: '8px',
            marginBottom: '8px',
          }}>
            MASAR
          </div>
          <div style={{ fontSize: '.78rem', color: '#4a5568', letterSpacing: '.5px' }}>
            نظام إدارة العلامة التجارية
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '18px',
          padding: 'clamp(24px, 5vw, 36px)',
          boxShadow: '0 20px 60px rgba(0,0,0,.45)',
          border: '1px solid rgba(255,255,255,.05)',
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', color: 'var(--text-1)' }}>
            تسجيل الدخول
          </h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">البريد الإلكتروني أو رقم الهاتف</label>
              <input
                type="text"
                className="form-input"
                placeholder="example@email.com  أو  01xxxxxxxxx"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                dir="ltr"
                style={{ textAlign: 'left' }}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                  style={{ textAlign: 'left', paddingLeft: 40 }}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', left: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--text-3)',
                    fontSize: '.85rem', padding: 4,
                  }}
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }} /> جارٍ الدخول...</>
                : 'دخول'}
            </button>
          </form>

          <p style={{
            marginTop: '20px', fontSize: '.74rem',
            color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.7,
          }}>
            هذا النظام مخصص لفريق ماسار فقط
            <br />
            للمشاكل التقنية تواصل مع المؤسس
          </p>
        </div>

        {/* Default credentials hint - remove in production */}
        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          background: 'rgba(44,107,78,.15)',
          border: '1px solid rgba(44,107,78,.25)',
          borderRadius: 10,
          fontSize: '.74rem',
          color: '#7ab89a',
          textAlign: 'center',
          lineHeight: 1.8,
          direction: 'ltr',
        }}>
          Default Admin: admin@masar.com<br />
          Password: Admin@Masar2025
        </div>
      </div>
    </div>
  )
}
