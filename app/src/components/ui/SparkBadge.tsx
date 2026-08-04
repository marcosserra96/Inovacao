import clsx from 'clsx'

const ICONS = {
  // lâmpada — usada no desafio individual
  bulb: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.44.9 1.15.9 1.9v.2h5.2v-.2c0-.75.3-1.46.9-1.9A6 6 0 0 0 12 3Z"
    />
  ),
  // raio — usada no duelo ao vivo
  bolt: <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
}

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, { container: string; iconSize: number }> = {
  sm: { container: 'h-14 w-14 rounded-2xl', iconSize: 24 },
  md: { container: 'h-20 w-20 rounded-[28px]', iconSize: 34 },
  lg: { container: 'h-28 w-28 rounded-[36px]', iconSize: 48 },
}

/**
 * Selo decorativo (ícone sobre um círculo em gradiente) usado para dar
 * identidade visual às telas de entrada, sem cair num estilo infantil.
 */
export function SparkBadge({
  className = '',
  icon = 'bulb',
  size = 'md',
}: {
  className?: string
  icon?: keyof typeof ICONS
  size?: Size
}) {
  const { container, iconSize } = sizeClasses[size]
  return (
    <div
      className={clsx(
        'animate-float mx-auto flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent shadow-xl shadow-primary/30',
        container,
        className,
      )}
    >
      <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none" stroke="white" strokeWidth="1.8">
        {ICONS[icon]}
      </svg>
    </div>
  )
}
