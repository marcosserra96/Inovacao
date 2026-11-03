import type { QuizVisualTheme } from '@/lib/quizVisualTheme'

export function QuizBrand({theme,small=false}: {theme:QuizVisualTheme;small?:boolean}) {
  const logos = [theme.logoPrimary, theme.logoSecondary].filter((src):src is string => Boolean(src))
  const splitAt = theme.title === 'Rota de Inovação' ? 'Rota de '.length : theme.title.indexOf(' ')
  const highlighted = splitAt > 0 ? theme.title.slice(0, splitAt) : theme.title
  const remainder = splitAt > 0 ? theme.title.slice(splitAt) : ''
  return <>
    <div className={small ? 'min-w-0 break-words font-display text-[19px] font-extrabold tracking-[-.045em] text-[var(--quiz-primary)]' : 'min-w-0 break-words font-display text-[clamp(1.35rem,2.15vw,2.55rem)] font-extrabold tracking-[-.045em] text-[var(--quiz-primary)]'}>
      <span className="text-[var(--quiz-primary)]">{highlighted}</span>{remainder && <span className="text-white">{remainder}</span>}
      {theme.subtitle && <div className="mt-1 text-[.5em] font-medium tracking-normal text-white/55">{theme.subtitle}</div>}
    </div>
    {logos.length>0 && <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      {logos.map((src,i)=><img key={i} src={src} alt={i===0?'Logo principal':'Logo secundária'} className={small?'h-5 max-w-16 object-contain':'h-[clamp(26px,4vh,42px)] max-w-32 object-contain'} />)}
    </div>}
  </>
}
