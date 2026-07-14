import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type TableName = keyof Database['public']['Tables']

/**
 * Mantém uma lista sincronizada em tempo real, filtrada por uma
 * coluna=valor (ex.: duel_players onde match_id = X). Usado nas telas de
 * duelo para refletir lobby, placar, rodadas e "quem respondeu" sem
 * depender de polling.
 */
export function useRealtimeList<T extends Record<string, unknown>>(
  table: TableName,
  filterColumn: string,
  filterValue: string | undefined,
  orderBy?: string,
) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  const retry = useCallback(() => setRetryTick((n) => n + 1), [])

  useEffect(() => {
    if (!filterValue) return
    let active = true
    setLoading(true)
    setError(null)

    let query = supabase.from(table).select('*').eq(filterColumn as never, filterValue)
    if (orderBy) query = query.order(orderBy as never)
    query.then(
      ({ data, error: fetchError }) => {
        if (!active) return
        if (fetchError) {
          setError('Não foi possível carregar. Verifique sua conexão.')
        } else {
          setRows((data as unknown as T[]) ?? [])
        }
        setLoading(false)
      },
      () => {
        if (active) {
          setError('Não foi possível carregar. Verifique sua conexão.')
          setLoading(false)
        }
      },
    )

    const channel = supabase
      .channel(`${table}:${filterColumn}:${filterValue}:${retryTick}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `${filterColumn}=eq.${filterValue}` },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new as T]
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((row) => (rowKey(row) === rowKey(payload.new as T) ? (payload.new as T) : row))
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((row) => rowKey(row) !== rowKey(payload.old as T))
            }
            return prev
          })
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filterColumn, filterValue, orderBy, retryTick])

  return { rows, loading, error, retry }
}

function rowKey(row: Record<string, unknown>): string {
  if ('id' in row) return String(row.id)
  // tabelas com chave composta (ex.: duel_answer_flags)
  return Object.values(row).slice(0, 2).join(':')
}
