import { useEffect, useState } from 'react'

/**
 * Cronômetro exibido ao usuário, derivado de um prazo absoluto calculado a
 * partir do tempo já decorrido no servidor. É puramente cosmético — a
 * validação real do prazo acontece no Postgres no momento da submissão.
 */
export function useCountdown(deadlineMs: number | null) {
  const [remainingMs, setRemainingMs] = useState(() => (deadlineMs ? Math.max(0, deadlineMs - Date.now()) : 0))

  useEffect(() => {
    if (!deadlineMs) return
    setRemainingMs(Math.max(0, deadlineMs - Date.now()))
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, deadlineMs - Date.now()))
    }, 100)
    return () => clearInterval(interval)
  }, [deadlineMs])

  return remainingMs
}
