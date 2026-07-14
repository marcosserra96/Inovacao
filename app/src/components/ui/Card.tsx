import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'bg-surface border border-border rounded-[28px] shadow-xl shadow-primary/[0.06] p-6',
        'animate-fade-up',
        className,
      )}
      {...props}
    />
  )
}
