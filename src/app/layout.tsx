import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/components/providers/auth-provider'
import { SettingsProvider } from '@/components/providers/settings-provider'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'MASAR — Brand Manager',
  description: 'نظام إدارة علامة ماسار التجارية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <SettingsProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  fontFamily: "'Cairo', sans-serif",
                  fontSize: '14px',
                  fontWeight: 600,
                  direction: 'rtl',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  maxWidth: '420px',
                },
                success: {
                  style: { background: '#e8f5ee', color: '#1e4f38', border: '1px solid #b3dcc7' },
                  iconTheme: { primary: '#2C6B4E', secondary: '#e8f5ee' },
                },
                error: {
                  style: { background: '#fdeaea', color: '#7a1f1f', border: '1px solid #f0bcbc' },
                  iconTheme: { primary: '#b83232', secondary: '#fdeaea' },
                },
              }}
            />
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
