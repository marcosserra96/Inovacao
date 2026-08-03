type FlashTone = 'correct' | 'wrong' | 'late'

const TONE_CLASS: Record<FlashTone, string> = {
  correct: 'bg-success',
  wrong: 'bg-danger',
  late: 'bg-accent',
}

/**
 * Tela cheia no instante da revelação: fundo sólido (verde/vermelho/
 * laranja) com um ícone grande "saltando" no centro — feedback instantâneo
 * estilo Kahoot de "acertei ou errei" antes de assentar no estado
 * detalhado.
 */
export function AnswerFlash({ tone }: { tone: FlashTone }) {
  return (
    <div
      className={`animate-flash-bg pointer-events-none fixed inset-0 z-50 flex items-center justify-center ${TONE_CLASS[tone]}`}
      aria-hidden="true"
    >
      <svg className="animate-flash-icon h-32 w-32 text-white drop-shadow-lg" viewBox="0 0 24 24" fill="none">
        {tone === 'correct' ? (
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <path d="M6 6l12 12" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            <path d="M18 6L6 18" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
          </>
        )}
      </svg>
    </div>
  )
}
