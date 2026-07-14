import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'bg-surface border border-border rounded-3xl shadow-sm shadow-black/5 p-6',
        className,
      )}
      {...props}
    />
  )
}
