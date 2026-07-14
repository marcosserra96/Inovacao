import { type ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:brightness-110 active:brightness-95 shadow-lg shadow-primary/25',
  secondary: 'bg-secondary text-white hover:brightness-110 active:brightness-95 shadow-lg shadow-secondary/25',
  accent: 'bg-accent text-white hover:brightness-110 active:brightness-95 shadow-lg shadow-accent/25',
  ghost: 'bg-transparent text-ink border-2 border-border hover:border-primary hover:text-primary',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95',
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
          'no-select font-semibold tracking-tight transition-all duration-150',
          'disabled:opacity-40 disabled:pointer-events-none',
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
