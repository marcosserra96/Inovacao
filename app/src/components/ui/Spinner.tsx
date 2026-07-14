import clsx from 'clsx'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={clsx(
        'inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
