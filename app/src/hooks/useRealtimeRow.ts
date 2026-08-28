import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type TableName = keyof Database['public']['Tables']

/**
 * Mantém uma única linha sincronizada em tempo real (Supabase Realtime
 * postgres_changes) a partir do seu id. Além do websocket, expõe refresh()
 * para confirmar o estado no banco sem desmontar/recriar o canal realtime.
 */
export function useRealtimeRow<T extends { id: string }>(table: TableName, id: string | undefined) {
  const [row, setRow] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchCurrent = useCallback(async () => {
    if (!id) return null
    const { data, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id' as never, id)
      .maybeSingle()

    if (!mountedRef.current) return null

    if (fetchError) {
      setError('Não foi possível carregar. Verifique sua conexão.')
      return null
    }

    const next = data as unknown as T | null
    setRow(next)
    setError(null)
    setLoading(false)
    return next
  }, [table, id])

  const refresh = useCallback(() => fetchCurrent(), [fetchCurrent])
  const retry = useCallback(() => setRetryTick((n) => n + 1), [])

  useEffect(() => {
    if (!id) return

    setLoading(true)
    setError(null)
    void fetchCurrent()

    const channel = supabase
      .channel(`${table}:${id}:${retryTick}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setRow(null)
          } else {
            setRow(payload.new as T)
          }
        },
      )
      .subscribe((status) => {
        // Realtime não garante replay dos eventos perdidos durante uma queda.
        // Confirmar a linha ao reconectar evita estado velho silencioso.
        if (status === 'SUBSCRIBED') void fetchCurrent()
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [table, id, retryTick, fetchCurrent])

  return { row, loading, error, retry, refresh }
}
