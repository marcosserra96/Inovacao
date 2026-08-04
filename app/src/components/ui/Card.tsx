import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass'

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-surface border border-border shadow-xl shadow-primary/[0.06]',
  elevated: 'bg-surface border border-border shadow-2xl shadow-primary/[0.1]',
  outlined: 'bg-transparent border-2 border-border',
  glass: 'glass',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  noPadding?: boolean
}

export function Card({ variant = 'default', noPadding, className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl',
        'animate-fade-up',
        variantClasses[variant],
        !noPadding && 'p-6',
        className,
      )}
      {...props}
    />
  )
}
