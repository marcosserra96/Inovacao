import clsx from 'clsx'
import { getOptionIdentity } from '@/lib/optionColors'

export type OptionState = 'default' | 'selected' | 'correct' | 'wrong' | 'late' | 'disabled'

interface OptionButtonProps {
  index: number
  text: string
  state: OptionState
  disabled?: boolean
  onClick?: () => void
  /** Stage mode: bigger, bolder for TV display */
  stage?: boolean
}

const stateClasses: Record<OptionState, string> = {
  default: 'border-border bg-surface text-ink',
  selected: 'border-primary bg-primary/5 text-ink',
  correct: 'border-success bg-success/10 text-success',
  wrong: 'border-danger bg-danger/10 text-danger',
  late: 'border-accent bg-accent/10 text-accent',
  disabled: 'border-border bg-surface/50 text-ink-muted opacity-60',
}

export function OptionButton({ index, text, state, disabled, onClick, stage }: OptionButtonProps) {
  const identity = getOptionIdentity(index)
  const isInteractive = state === 'default' && !disabled

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={identity.ariaLabel}
      className={clsx(
        'no-select flex w-full items-center gap-3 rounded-2xl border-2 text-left font-semibold transition-all duration-200',
        'disabled:cursor-default',
        'animate-pop',
        stage ? 'px-6 py-5 text-xl' : 'px-4 py-4 text-base min-h-[56px]',
        stateClasses[state],
        isInteractive && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]',
      )}
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <span
        className={clsx(
          'flex shrink-0 items-center justify-center rounded-xl',
          stage ? 'h-10 w-10' : 'h-8 w-8',
        )}
        style={{ backgroundColor: identity.color }}
      >
        <svg
          viewBox="0 0 24 24"
          className={stage ? 'h-5 w-5' : 'h-4 w-4'}
          fill="white"
          stroke="none"
        >
          <path d={identity.shapePath} />
        </svg>
      </span>
      <span className="flex-1 min-w-0">{text}</span>
    </button>
  )
}
