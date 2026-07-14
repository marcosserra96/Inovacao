import { Button } from '@/components/ui/Button'
import clsx from 'clsx'

export function RetryableError({
  message,
  onRetry,
  tone = 'light',
}: {
  message: string
  onRetry: () => void
  tone?: 'light' | 'dark'
}) {
  return (
    <div className="text-center">
      <p className={clsx('mb-4', tone === 'dark' ? 'text-white/70' : 'text-ink-muted')}>{message}</p>
      <Button variant="ghost" onClick={onRetry} className={tone === 'dark' ? 'border-white/30 text-white' : undefined}>
        Tentar novamente
      </Button>
    </div>
  )
}
