import { forwardRef, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        'w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted/60',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
