import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type TableName = keyof Database['public']['Tables']

/**
 * Mantém uma única linha sincronizada em tempo real (Supabase Realtime
 * postgres_changes) a partir do seu id. Usado para duel_matches, cujo
 * estado dirige o que todas as telas (telão, apresentador, participantes)
 * devem mostrar a cada momento.
 */
export function useRealtimeRow<T extends { id: string }>(table: TableName, id: string | undefined) {
  const [row, setRow] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  const retry = useCallback(() => setRetryTick((n) => n + 1), [])

  useEffect(() => {
    if (!id) return
    const rowId = id
    let active = true

    async function fetchCurrent() {
      const { data, error: fetchError } = await supabase.from(table).select('*').eq('id' as never, rowId).maybeSingle()
      if (!active) return
      if (fetchError) {
        setError('Não foi possível carregar. Verifique sua conexão.')
      } else {
        setRow(data as unknown as T | null)
        setError(null)
      }
      setLoading(false)
    }

    setLoading(true)
    setError(null)
    fetchCurrent()

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
        // Reconexões (wi-fi instável etc.) não garantem entrega dos eventos
        // perdidos durante a queda — refazer o select ao reconectar evita
        // ficar com um estado desatualizado silenciosamente.
        if (status === 'SUBSCRIBED') fetchCurrent()
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [table, id, retryTick])

  return { row, loading, error, retry }
}
