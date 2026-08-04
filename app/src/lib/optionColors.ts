/**
 * Identidade visual das alternativas do quiz — cada opção possui cor,
 * forma geométrica (SVG path) e label acessível para não depender
 * somente da cor para diferenciar.
 */

export interface OptionIdentity {
  /** Índice da opção (0-3) */
  index: number
  /** Letra da alternativa (A, B, C, D) */
  letter: string
  /** Cor da alternativa (CSS variable) */
  color: string
  /** Nome da forma ("circle" | "triangle" | "square" | "diamond") */
  shapeName: string
  /** SVG path para a forma geométrica (viewBox 0 0 24 24) */
  shapePath: string
  /** Label acessível (e.g. "Alternativa A — Círculo") */
  ariaLabel: string
  /** Tailwind class para o fundo */
  bgClass: string
}

const OPTION_IDENTITIES: OptionIdentity[] = [
  {
    index: 0,
    letter: 'A',
    color: 'var(--option-a)',
    shapeName: 'circle',
    shapePath: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z',
    ariaLabel: 'Alternativa A — Círculo',
    bgClass: 'bg-option-a',
  },
  {
    index: 1,
    letter: 'B',
    color: 'var(--option-b)',
    shapeName: 'triangle',
    shapePath: 'M12 3 L22 20 L2 20 Z',
    ariaLabel: 'Alternativa B — Triângulo',
    bgClass: 'bg-option-b',
  },
  {
    index: 2,
    letter: 'C',
    color: 'var(--option-c)',
    shapeName: 'square',
    shapePath: 'M4 4h16v16H4z',
    ariaLabel: 'Alternativa C — Quadrado',
    bgClass: 'bg-option-c',
  },
  {
    index: 3,
    letter: 'D',
    color: 'var(--option-d)',
    shapeName: 'diamond',
    shapePath: 'M12 2 L22 12 L12 22 L2 12 Z',
    ariaLabel: 'Alternativa D — Losango',
    bgClass: 'bg-option-d',
  },
]

/** Retorna a identidade visual de uma alternativa pelo índice (0-based). */
export function getOptionIdentity(index: number): OptionIdentity {
  return OPTION_IDENTITIES[index % OPTION_IDENTITIES.length]
}

/** Retorna todas as identidades (para loops de renderização). */
export function getAllOptionIdentities(): OptionIdentity[] {
  return OPTION_IDENTITIES
}

/**
 * Array legado de cores para retrocompatibilidade — use getOptionIdentity()
 * quando possível para ter acesso às formas e labels.
 */
export const OPTION_COLORS = OPTION_IDENTITIES.map((o) => o.color)
