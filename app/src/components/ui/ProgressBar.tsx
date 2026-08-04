import clsx from 'clsx'

interface ProgressBarProps {
  value: number
  max?: number
  tone?: 'primary' | 'accent' | 'success' | 'danger'
  size?: 'sm' | 'md'
  animated?: boolean
  label?: string
}

const toneColors: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  size = 'md',
  animated = true,
  label,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={clsx(
        'w-full overflow-hidden rounded-full bg-ink/10',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
      )}
    >
      <div
        className={clsx(
          'h-full rounded-full',
          toneColors[tone],
          animated && 'transition-[width] duration-500 ease-out',
        )}
        style={{ width: `${pct}%` }}
      />
      {label && <span className="sr-only">{label}</span>}
    </div>
  )
}
