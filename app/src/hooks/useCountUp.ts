import { useEffect, useState } from 'react'

/**
 * Anima um número subindo de 0 até `target` — usado no "+X pontos" da
 * revelação, pra dar aquele efeito de placar contando ao vivo (estilo
 * Kahoot) em vez do número aparecer pronto.
 */
export function useCountUp(target: number, active: boolean, duration = 700) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) {
      setValue(0)
      return
    }
    let frame: number
    const start = performance.now()

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(Math.round(eased * target))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target, duration])

  return value
}
