import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ClockPayload = {
  serverNow?: string
  flowState?: string | null
  deadlineAt?: string | null
  paused?: boolean
  remainingMs?: number
  updatedAt?: string | null
}

type Sample = {
  offsetMs: number
  rttMs: number
}

export function useServerClock(sessionId?: string, resyncKey?: string | null) {
  const [offsetMs, setOffsetMs] = useState(0)
  const [synced, setSynced] = useState(false)
  const bestRttRef = useRef<number>(Number.POSITIVE_INFINITY)

  const sync = useCallback(async () => {
    if (!sessionId) return null

    const startedAt = Date.now()
    const { data, error } = await supabase.rpc('get_live_dynamic_clock' as never, {
      p_session_id: sessionId,
    } as never)
    const finishedAt = Date.now()

    if (error || !data) return null

    const payload = data as unknown as ClockPayload
    const serverMs = payload.serverNow ? new Date(payload.serverNow).getTime() : Number.NaN
    if (!Number.isFinite(serverMs)) return null

    const sample: Sample = {
      // Aproxima o instante da resposta do servidor pelo ponto médio do RTT.
      offsetMs: serverMs - ((startedAt + finishedAt) / 2),
      rttMs: finishedAt - startedAt,
    }

    // Amostras de menor RTT sofrem menos erro de rede. Aceita também uma
    // amostra um pouco pior periodicamente para acompanhar drift do relógio.
    if (!synced || sample.rttMs <= bestRttRef.current + 40) {
      bestRttRef.current = Math.min(bestRttRef.current, sample.rttMs)
      setOffsetMs((current) => synced ? (current * 0.25) + (sample.offsetMs * 0.75) : sample.offsetMs)
      setSynced(true)
    }

    return payload
  }, [sessionId, synced])

  useEffect(() => {
    if (!sessionId) {
      setOffsetMs(0)
      setSynced(false)
      bestRttRef.current = Number.POSITIVE_INFINITY
      return
    }

    let active = true

    const calibrate = async () => {
      // Duas amostras iniciais diminuem bastante o impacto de uma primeira
      // chamada fria/mais lenta sem aumentar o tráfego durante a dinâmica.
      await sync()
      if (active) await sync()
    }

    void calibrate()
    const timer = window.setInterval(() => void sync(), 15000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [sessionId, sync])

  useEffect(() => {
    if (!sessionId || !resyncKey) return
    void sync()
  }, [sessionId, resyncKey, sync])

  return {
    offsetMs,
    synced,
    serverNowMs: (clientNowMs: number) => clientNowMs + offsetMs,
    resync: sync,
  }
}
