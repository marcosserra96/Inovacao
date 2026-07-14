import clsx from 'clsx'

export function TimerRing({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const seconds = Math.ceil(remainingMs / 1000)
  const circumference = 2 * Math.PI * 26
  const urgent = ratio < 0.25

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90">
        <circle cx="30" cy="30" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-ink/10" />
        <circle
          cx="30"
          cy="30"
          r="26"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={clsx('transition-[stroke-dashoffset] duration-150', urgent ? 'text-danger' : 'text-primary')}
          stroke="currentColor"
        />
      </svg>
      <span
        className={clsx(
          'absolute inset-0 flex items-center justify-center font-display text-lg font-bold',
          urgent ? 'text-danger' : 'text-ink',
        )}
      >
        {seconds}
      </span>
    </div>
  )
}
