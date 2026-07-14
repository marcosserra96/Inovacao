import { type ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-primary to-primary-dark text-white shadow-lg shadow-primary/30 hover:brightness-110 active:brightness-95',
  secondary:
    'bg-gradient-to-b from-secondary to-primary text-white shadow-lg shadow-secondary/30 hover:brightness-110 active:brightness-95',
  accent: 'bg-gradient-to-b from-accent to-[#d96700] text-white shadow-lg shadow-accent/30 hover:brightness-110 active:brightness-95',
  ghost: 'bg-surface text-ink border-2 border-border hover:border-primary hover:text-primary',
  danger: 'bg-gradient-to-b from-danger to-[#c22a44] text-white shadow-lg shadow-danger/30 hover:brightness-110 active:brightness-95',
}

const sizeClasses: Record<Size, string> = {
  md: 'text-base px-5 py-3 rounded-xl',
  lg: 'text-lg px-6 py-4 rounded-2xl',
  xl: 'text-xl px-8 py-5 rounded-2xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'lg', className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={clsx(
          'no-select font-display font-bold tracking-tight transition-all duration-150',
          'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
          'disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
