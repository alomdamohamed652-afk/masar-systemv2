'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseApiOptions {
  immediate?: boolean
}

export function useApi<T>(
  url: string | null,
  options: UseApiOptions = { immediate: true }
) {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const abortRef              = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async (overrideUrl?: string) => {
    const target = overrideUrl ?? url
    if (!target) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const res  = await fetch(target, { signal: abortRef.current.signal })
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'حدث خطأ غير متوقع')
      } else {
        setData(json.data)
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setError('تعذّر الاتصال بالخادم')
      }
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    if (options.immediate && url) fetch_()
    return () => abortRef.current?.abort()
  }, [url, options.immediate, fetch_])

  return { data, loading, error, refetch: fetch_ }
}

// Generic mutation hook
export function useMutation<TInput, TOutput>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST'
) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const mutate = useCallback(async (body?: TInput): Promise<TOutput | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'حدث خطأ غير متوقع')
        return null
      }
      return json.data as TOutput
    } catch {
      setError('تعذّر الاتصال بالخادم')
      return null
    } finally {
      setLoading(false)
    }
  }, [url, method])

  return { mutate, loading, error }
}
