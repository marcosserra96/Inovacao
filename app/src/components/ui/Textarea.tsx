import { forwardRef, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        'w-full rounded-xl border-2 border-border bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted/60 transition-colors',
        'focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
