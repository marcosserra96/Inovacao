import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
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
Input.displayName = 'Input'

export function Field({
  label,
  hint,
  children,
  htmlFor,
  ...rest
}: { label: string; hint?: string; children: ReactNode } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={htmlFor} {...rest}>
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </label>
  )
}
