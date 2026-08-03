type FlashTone = 'correct' | 'wrong' | 'late'

const TONE_CLASS: Record<FlashTone, string> = {
  correct: 'bg-success',
  wrong: 'bg-danger',
  late: 'bg-accent',
}

/**
 * Flash de tela cheia no instante da revelação (verde/vermelho/laranja),
 * antes de assentar no estado detalhado — feedback instantâneo estilo
 * Kahoot de "acertei ou errei" sem precisar ler nada.
 */
export function AnswerFlash({ tone }: { tone: FlashTone }) {
  return <div className={`animate-flash pointer-events-none fixed inset-0 z-50 ${TONE_CLASS[tone]}`} aria-hidden="true" />
}
