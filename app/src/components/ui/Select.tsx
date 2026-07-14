import { forwardRef, type SelectHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx(
        'w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-ink transition-colors',
        'focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary',
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
