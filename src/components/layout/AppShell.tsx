'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const pathname = usePathname()

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('masar-theme') as 'light' | 'dark' | null
    const preferred = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(preferred)
    document.documentElement.setAttribute('data-theme', preferred)
  }, [])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Close sidebar on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Prevent body scroll when sidebar open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('masar-theme', next)
  }, [theme])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const openSidebar  = useCallback(() => setSidebarOpen(true), [])

  return (
    <div className="app-shell">
      <Sidebar
        mobileOpen={sidebarOpen}
        onClose={closeSidebar}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="main-content" id="main-content">
        {/* Mobile topbar */}
        <div className="mobile-topbar">
          <button
            onClick={openSidebar}
            aria-label="فتح القائمة"
            style={{
              background: 'none', border: 'none',
              color: '#F7F6E5', fontSize: '1.4rem',
              cursor: 'pointer', padding: '8px',
              lineHeight: 1, display: 'flex', alignItems: 'center',
            }}
          >
            ☰
          </button>

          <span style={{
            fontWeight: 900, fontSize: '1.15rem',
            color: '#F7F6E5', letterSpacing: '4px',
          }}>
            MASAR
          </span>

          <button
            onClick={toggleTheme}
            aria-label="تغيير المظهر"
            style={{
              background: 'none', border: 'none',
              color: '#F7F6E5', fontSize: '1.1rem',
              cursor: 'pointer', padding: '8px',
              lineHeight: 1, display: 'flex', alignItems: 'center',
            }}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </div>

        {children}
      </main>
    </div>
  )
}
