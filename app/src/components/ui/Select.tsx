import { forwardRef, type SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx(
        'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-ink',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
