import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type GameControl = Database['public']['Tables']['game_control']['Row']

/**
 * Lê e acompanha em tempo real qual é "o jogo de agora" (modo ativo +
 * sessão/partida vigente), definido pelo admin em /admin/jogo. É o que
 * permite a tela inicial levar cada participante direto para o que ele
 * deve jogar, sem link/código separado por atividade.
 */
export function useGameControl() {
  const [control, setControl] = useState<GameControl | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const retry = useCallback(() => setRetryTick((n) => n + 1), [])

  useEffect(() => {
    let active = true

    async function fetchCurrent() {
      const { data, error: fetchError } = await supabase.from('game_control').select('*').eq('id', true).maybeSingle()
      if (!active) return
      if (fetchError) setError('Não foi possível carregar. Verifique sua conexão.')
      else {
        setControl(data)
        setError(null)
      }
      setLoading(false)
    }

    setLoading(true)
    setError(null)
    fetchCurrent()

    const channel = supabase
      .channel(`game_control:${retryTick}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_control' }, (payload) => {
        setControl(payload.new as GameControl)
      })
      .subscribe((status) => {
        // Reconexões (após queda de wi-fi etc.) não garantem entrega dos
        // eventos perdidos durante a queda — refazer o select ao
        // reconectar evita ficar com um estado desatualizado silencioso.
        if (status === 'SUBSCRIBED') fetchCurrent()
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [retryTick])

  return { control, loading, error, retry }
}
