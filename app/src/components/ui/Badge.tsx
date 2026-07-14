import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

type Tone = 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'neutral'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-ink/5 text-ink-muted',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
