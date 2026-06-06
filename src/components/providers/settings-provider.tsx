'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Settings } from '@/types'

interface SettingsContextValue {
  settings: Settings | null
  loading: boolean
  timezone: string
  currency: string
  refresh: () => Promise<void>
}

const DEFAULT_SETTINGS: Partial<Settings> = {
  brand_name: 'MASAR',
  currency: 'EGP',
  timezone: 'Africa/Cairo',
  low_stock_threshold: 10,
  tax_rate: 0,
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  loading: true,
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  refresh: async () => {},
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = async () => {
    const { data } = await supabase
      .from('settings')
      .select('*')
      .single()
    if (data) setSettings(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <SettingsContext.Provider value={{
      settings,
      loading,
      timezone: settings?.timezone ?? DEFAULT_SETTINGS.timezone!,
      currency: settings?.currency ?? DEFAULT_SETTINGS.currency!,
      refresh: load,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
