import { useEffect, useState } from 'react'

interface TimerFields {
  timer_started_at: string | null
  timer_duration_seconds: number
  timer_paused_at: string | null
  timer_accumulated_ms: number
}

/**
 * Cronômetro cosmético do duelo: cobre rodando, pausado e ainda não
 * iniciado. A validação real do prazo acontece no servidor no momento da
 * submissão (submit_duel_answer), usando os mesmos campos.
 */
export function useDuelTimer(round: TimerFields | null | undefined) {
  const [remainingMs, setRemainingMs] = useState(0)

  useEffect(() => {
    if (!round || !round.timer_started_at) {
      setRemainingMs(0)
      return
    }
    const durationMs = round.timer_duration_seconds * 1000
    const startedAtMs = new Date(round.timer_started_at).getTime()

    function compute() {
      if (!round) return 0
      if (round.timer_paused_at) {
        return Math.max(0, durationMs - round.timer_accumulated_ms)
      }
      const elapsed = round.timer_accumulated_ms + (Date.now() - startedAtMs)
      return Math.max(0, durationMs - elapsed)
    }

    setRemainingMs(compute())
    if (round.timer_paused_at) return

    const interval = setInterval(() => setRemainingMs(compute()), 100)
    return () => clearInterval(interval)
  }, [round?.timer_started_at, round?.timer_paused_at, round?.timer_accumulated_ms, round?.timer_duration_seconds])

  return remainingMs
}
