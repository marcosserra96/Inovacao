import { useMemo, useState } from 'react'

type PreviewState =
  | 'lobby'
  | 'quiz'
  | 'paused'
  | 'quizResult'
  | 'semifinal'
  | 'semifinalResult'
  | 'final'
  | 'champion'

type RankingItem = {
  position: number
  name: string
  score: number
}

const ranking: RankingItem[] = [
  { position: 1, name: 'Ana Martins', score: 9860 },
  { position: 2, name: 'João Pedro', score: 9420 },
  { position: 3, name: 'Marcos Silva', score: 9150 },
  { position: 4, name: 'Carla Souza', score: 8780 },
  { position: 5, name: 'Pedro Lima', score: 7980 },
  { position: 6, name: 'Bruno Alves', score: 7310 },
  { position: 7, name: 'Camila Rocha', score: 6860 },
  { position: 8, name: 'Rafael Melo', score: 6240 },
  { position: 9, name: 'Luana Costa', score: 5640 },
  { position: 10, name: 'Felipe Nunes', score: 4980 },
]

const stateOptions: Array<{ value: PreviewState; label: string }> = [
  { value: 'lobby', label: 'Lobby' },
  { value: 'quiz', label: 'Quiz ao vivo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'quizResult', label: 'Fim do quiz' },
  { value: 'semifinal', label: 'Semifinais' },
  { value: 'semifinalResult', label: 'Fim das semifinais' },
  { value: 'final', label: 'Final' },
  { value: 'champion', label: 'Campeão' },
]

function Icon({ name, className = 'h-5 w-5' }: { name: 'users' | 'pause' | 'play' | 'signal' | 'flag' | 'trophy'; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths = {
    users: <><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle {...common} cx="9" cy="7" r="4"/><path {...common} d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    pause: <><circle {...common} cx="12" cy="12" r="9"/><path {...common} d="M10 9v6M14 9v6"/></>,
    play: <><circle {...common} cx="12" cy="12" r="9"/><path {...common} d="m10 8 6 4-6 4Z"/></>,
    signal: <><path {...common} d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></>,
    flag: <><path {...common} d="M5 21V4"/><path {...common} d="M5 5h10l-1.5 3L15 11H5"/></>,
    trophy: <><path {...common} d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0Z"/><path {...common} d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/></>,
  }
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{paths[name]}</svg>
}

function BrandHeader() {
  return (
    <header className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-[clamp(10px,1.7vh,20px)]">
      <div className="flex min-w-0 items-center gap-[clamp(12px,1.4vw,20px)]">
        <div className="font-display text-[clamp(1.45rem,2.15vw,2.55rem)] font-extrabold tracking-[-0.04em]">
          <span className="text-[#a7d52c]">Rota de </span><span className="text-white">Inovação</span>
        </div>
        <div className="hidden h-9 w-px bg-white/30 sm:block" />
        <div className="hidden text-sm font-medium text-white/75 sm:block md:text-base">Painel do Apresentador</div>
      </div>
      <div className="flex items-center gap-4 text-white">
        <div className="text-right leading-none">
          <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/65">Grupo</div>
          <div className="font-display text-[clamp(1rem,1.35vw,1.25rem)] font-bold tracking-tight">energisa</div>
        </div>
        <div className="h-7 w-px bg-white/30" />
        <div className="font-display text-[clamp(1rem,1.35vw,1.25rem)] font-bold tracking-tight"><span className="text-[#9dd52b]">e</span>nova</div>
      </div>
      <div className="absolute -bottom-px left-0 h-px w-[42%] bg-gradient-to-r from-[#a7d52c] via-[#6bd27f] to-[#00b6da]" />
    </header>
  )
}

function CountdownRing({ seconds = 8, prepare = false }: { seconds?: number; prepare?: boolean }) {
  const radius = 106
  const circumference = 2 * Math.PI * radius
  const progress = prepare ? 0.72 : 0.67
  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[min(280px,29vh)] place-items-center">
      <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="130" cy="130" r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12" />
        <circle cx="130" cy="130" r={radius} fill="none" stroke="#a7d52c" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} style={{ filter: 'drop-shadow(0 0 8px rgba(167,213,44,.45))' }} />
        <circle cx="130" cy="130" r="122" fill="none" stroke="rgba(0,182,218,.28)" strokeWidth="1" strokeDasharray="2 9" />
      </svg>
      <div className="relative text-center">
        {prepare && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#00b6da]">Prepare-se</div>}
        <div className="font-display text-[clamp(3.5rem,6vw,5.8rem)] font-extrabold leading-none tracking-[-0.06em] text-[#a7d52c]">
          {seconds}<span className="ml-1 text-[0.35em]">s</span>
        </div>
      </div>
    </div>
  )
}

function AnswerProgress() {
  const answered = 32
  const total = 47
  const percent = Math.round((answered / total) * 100)
  return (
    <div>
      <div className="mb-[clamp(6px,1vh,12px)] flex flex-wrap items-end gap-x-2 gap-y-1">
        <Icon name="users" className="mr-2 h-7 w-7 text-[#a7d52c]" />
        <span className="font-display text-[clamp(1.8rem,2.6vw,2.5rem)] font-extrabold leading-none text-[#a7d52c]">{answered}</span>
        <span className="pb-0.5 text-lg font-semibold text-white">de</span>
        <span className="font-display text-[clamp(1.8rem,2.6vw,2.5rem)] font-extrabold leading-none text-[#a7d52c]">{total}</span>
        <span className="pb-0.5 text-base text-white/80">responderam</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#b2e32c] to-[#8ccf2a] shadow-[0_0_18px_rgba(167,213,44,.25)]" style={{ width: `${percent}%` }} />
        </div>
        <span className="min-w-12 text-sm font-bold text-[#00b6da]">{percent}%</span>
      </div>
    </div>
  )
}

function RankingPanel() {
  return (
    <aside className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/88 p-[clamp(10px,1.4vh,18px)] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur-xl">
      <div className="mb-[clamp(6px,1vh,14px)] flex shrink-0 items-center gap-3">
        <Icon name="trophy" className="h-5 w-5 text-[#a7d52c]" />
        <h2 className="font-display text-[clamp(1rem,1.4vw,1.25rem)] font-bold text-white">Ranking ao vivo</h2>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[repeat(11,minmax(0,1fr))] gap-[clamp(2px,0.35vh,6px)]">
        {ranking.map((item) => (
          <div key={item.position} className={item.position === 4 ? 'contents' : 'contents'}>
            <div className={`grid min-h-0 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] border px-2.5 ${item.position <= 4 ? 'border-[#a7d52c]/28 bg-[#a7d52c]/8' : 'border-white/8 bg-white/[0.025]'}`}>
              <div className={`grid h-7 w-7 place-items-center rounded-lg font-display text-xs font-bold ${item.position <= 4 ? 'bg-[#a7d52c]/18 text-[#c4eb50]' : 'bg-white/7 text-white'}`}>{item.position}</div>
              <div className="min-w-0 truncate text-[clamp(11px,0.9vw,14px)] font-medium text-white/90">{item.name}</div>
              <div className={`text-[clamp(11px,0.9vw,14px)] font-bold tabular-nums ${item.position <= 4 ? 'text-[#b6df3a]' : 'text-white/78'}`}>{item.score.toLocaleString('pt-BR')}</div>
            </div>
            {item.position === 4 && (
              <div className="flex min-h-0 items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#a7d52c]">
                <div className="h-px flex-1 border-t border-dashed border-[#a7d52c]/55" />
                Corte para semifinal
                <div className="h-px flex-1 border-t border-dashed border-[#a7d52c]/55" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-[clamp(5px,0.8vh,12px)] flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-[clamp(5px,0.8vh,10px)] text-[11px]">
        <div className="flex items-center gap-2 font-semibold text-[#b4de36]"><Icon name="users" className="h-4 w-4" />47 conectados</div>
        <div className="flex items-center gap-2 text-[#00b6da]"><Icon name="signal" className="h-4 w-4" />Atualização em tempo real</div>
      </div>
    </aside>
  )
}

function MatchSidebar({ final = false }: { final?: boolean }) {
  const matches = final
    ? [{ title: 'Grande final', a: 'Ana Martins', scoreA: 3, b: 'Marcos Silva', scoreB: 2 }]
    : [
        { title: 'Semifinal 1', a: 'Ana Martins', scoreA: 3, b: 'Carla Souza', scoreB: 2 },
        { title: 'Semifinal 2', a: 'João Pedro', scoreA: 1, b: 'Marcos Silva', scoreB: 3 },
      ]
  return (
    <aside className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/88 p-[clamp(12px,1.8vh,20px)] backdrop-blur-xl">
      <div className="mb-[clamp(8px,1.4vh,18px)] flex shrink-0 items-center gap-3"><Icon name="trophy" className="h-5 w-5 text-[#a7d52c]" /><h2 className="font-display text-[clamp(1rem,1.4vw,1.25rem)] font-bold text-white">{final ? 'Final ao vivo' : 'Semifinais ao vivo'}</h2></div>
      <div className="grid min-h-0 flex-1 gap-[clamp(8px,1.4vh,16px)]" style={{ gridTemplateRows: `repeat(${matches.length}, minmax(0, 1fr))` }}>
        {matches.map((match) => (
          <div key={match.title} className="flex min-h-0 flex-col justify-center rounded-2xl border border-white/9 bg-white/[0.035] p-[clamp(10px,1.6vh,16px)]">
            <div className="mb-[clamp(6px,1vh,12px)] text-[11px] font-bold uppercase tracking-[0.18em] text-[#00b6da]">{match.title}</div>
            <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/8 pb-[clamp(6px,1vh,12px)]"><span className="font-semibold text-white">{match.a}</span><span className="font-display text-xl font-bold text-[#a7d52c]">{match.scoreA}</span></div>
            <div className="grid grid-cols-[1fr_auto] gap-3 pt-[clamp(6px,1vh,12px)]"><span className="font-semibold text-white">{match.b}</span><span className="font-display text-xl font-bold text-[#a7d52c]">{match.scoreB}</span></div>
          </div>
        ))}
      </div>
      <div className="mt-[clamp(6px,1vh,12px)] shrink-0 border-t border-white/8 pt-[clamp(6px,1vh,10px)] text-[11px] text-white/60">Pergunta 04 de 05 · atualização em tempo real</div>
    </aside>
  )
}

function PrimaryAction({ state, setState }: { state: PreviewState; setState: (state: PreviewState) => void }) {
  const config: Partial<Record<PreviewState, { label: string; icon: 'play' | 'pause'; next: PreviewState }>> = {
    lobby: { label: 'Iniciar Quiz', icon: 'play', next: 'quiz' },
    quiz: { label: 'Pausar', icon: 'pause', next: 'paused' },
    paused: { label: 'Retomar', icon: 'play', next: 'quiz' },
    quizResult: { label: 'Iniciar Semifinais', icon: 'play', next: 'semifinal' },
    semifinal: { label: 'Pausar', icon: 'pause', next: 'paused' },
    semifinalResult: { label: 'Iniciar Final', icon: 'play', next: 'final' },
    final: { label: 'Pausar', icon: 'pause', next: 'paused' },
  }
  const action = config[state]
  if (!action) return null
  return (
    <button type="button" onClick={() => setState(action.next)} className="mt-[clamp(8px,1.4vh,18px)] flex h-[clamp(46px,7vh,62px)] w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-[#a7d52c] px-6 font-display text-[clamp(1rem,1.35vw,1.25rem)] font-extrabold text-[#07152f] shadow-[0_0_34px_rgba(167,213,44,.18)] transition hover:bg-[#b6e33c] focus:outline-none focus:ring-2 focus:ring-[#00b6da] focus:ring-offset-2 focus:ring-offset-[#07152f]">
      <Icon name={action.icon} className="h-6 w-6" />{action.label}
    </button>
  )
}

function MainStage({ state, setState }: { state: PreviewState; setState: (state: PreviewState) => void }) {
  const isQuiz = state === 'quiz' || state === 'paused'
  const isSemifinal = state === 'semifinal'
  const isFinal = state === 'final'

  const content = useMemo(() => {
    if (state === 'lobby') return { eyebrow: 'Aguardando participantes', title: 'Lobby', subtitle: '47 participantes conectados' }
    if (isQuiz) return { eyebrow: state === 'paused' ? 'Jogo pausado' : 'Jogo ao vivo', title: 'Quiz Coletivo', subtitle: 'Pergunta 06 de 10' }
    if (state === 'quizResult') return { eyebrow: 'Etapa concluída', title: 'Quiz concluído', subtitle: 'Os 4 semifinalistas estão definidos' }
    if (isSemifinal) return { eyebrow: 'Jogo ao vivo', title: 'Semifinais', subtitle: 'Pergunta 04 de 05' }
    if (state === 'semifinalResult') return { eyebrow: 'Etapa concluída', title: 'Temos nossos finalistas', subtitle: 'Ana Martins × Marcos Silva' }
    if (isFinal) return { eyebrow: 'Jogo ao vivo', title: 'Grande Final', subtitle: 'Pergunta 04 de 05' }
    return { eyebrow: 'Dinâmica concluída', title: 'Temos um campeão!', subtitle: 'Rota de Inovação' }
  }, [state, isQuiz, isSemifinal, isFinal])

  return (
    <section className="relative z-10 flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/78 p-[clamp(14px,2.1vh,26px)] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] backdrop-blur-xl">
      <div className="mb-[clamp(8px,1.4vh,18px)] inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-white/14 bg-[#081d3e]/70 px-3.5 py-1.5 text-[11px] font-bold text-[#b8df3f]">
        <span className={`h-2 w-2 rounded-full ${state === 'paused' ? 'bg-[#ffb547]' : 'bg-[#a7d52c]'}`} />{content.eyebrow}
      </div>

      <div className="grid min-h-0 flex-1 items-center gap-[clamp(12px,2vw,28px)] lg:grid-cols-[minmax(0,1fr)_minmax(210px,28vh)]">
        <div className="min-w-0 self-center">
          <h1 className="font-display text-[clamp(2.25rem,4.2vw,4.5rem)] font-extrabold leading-[0.96] tracking-[-0.055em] text-white">{content.title}</h1>
          <p className="mt-[clamp(8px,1.3vh,16px)] text-[clamp(1rem,1.35vw,1.35rem)] font-medium text-white/72">{content.subtitle}</p>
          <div className="mt-[clamp(8px,1.3vh,16px)] h-px w-60 max-w-[45%] bg-gradient-to-r from-[#a7d52c] to-[#00b6da]" />

          {(isQuiz || isSemifinal || isFinal) && <div className="mt-[clamp(14px,2.6vh,30px)] max-w-xl"><AnswerProgress /></div>}

          {state === 'lobby' && (
            <div className="mt-[clamp(14px,2.6vh,30px)] grid max-w-xl grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/9 bg-white/[0.035] p-[clamp(10px,1.5vh,16px)]"><div className="text-xs text-white/55">Conectados</div><div className="mt-1 font-display text-[clamp(1.8rem,2.5vw,2.5rem)] font-bold leading-none text-[#a7d52c]">47</div></div>
              <div className="rounded-2xl border border-white/9 bg-white/[0.035] p-[clamp(10px,1.5vh,16px)]"><div className="text-xs text-white/55">Status</div><div className="mt-1.5 text-sm font-semibold text-white">Pronto para iniciar</div></div>
            </div>
          )}

          {state === 'quizResult' && (
            <div className="mt-[clamp(14px,2.4vh,28px)] grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4">{ranking.slice(0,4).map((item) => <div key={item.position} className="rounded-2xl border border-[#a7d52c]/25 bg-[#a7d52c]/8 p-[clamp(9px,1.4vh,14px)]"><div className="text-[10px] font-bold uppercase tracking-wider text-[#a7d52c]">{item.position}º lugar</div><div className="mt-1.5 truncate font-display text-sm font-bold text-white">{item.name}</div></div>)}</div>
          )}

          {state === 'semifinalResult' && (
            <div className="mt-[clamp(14px,2.4vh,28px)] flex max-w-2xl items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-[clamp(10px,1.6vh,16px)]"><span className="font-display text-[clamp(1.1rem,1.6vw,1.5rem)] font-bold text-white">Ana Martins</span><span className="text-[#00b6da]">×</span><span className="font-display text-[clamp(1.1rem,1.6vw,1.5rem)] font-bold text-white">Marcos Silva</span></div>
          )}

          {state === 'champion' && (
            <div className="mt-[clamp(14px,2.4vh,28px)] flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-[#a7d52c]/13 text-[#a7d52c]"><Icon name="trophy" className="h-8 w-8" /></div><div><div className="text-xs uppercase tracking-[0.2em] text-white/50">Campeão</div><div className="font-display text-[clamp(1.8rem,2.7vw,2.8rem)] font-extrabold leading-none text-[#a7d52c]">Marcos Silva</div></div></div>
          )}
        </div>

        {(isQuiz || isSemifinal || isFinal) && <CountdownRing seconds={8} />}
        {state === 'lobby' && <div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#00b6da]/20 bg-[#00b6da]/5 text-center"><div><Icon name="users" className="mx-auto mb-2 h-9 w-9 text-[#a7d52c]" /><div className="font-display text-[clamp(3rem,4.5vw,4.5rem)] font-extrabold leading-none text-white">47</div><div className="mt-1.5 text-xs text-white/55">participantes</div></div></div>}
        {state === 'quizResult' && <div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#a7d52c]/20 bg-[#a7d52c]/5"><Icon name="trophy" className="h-[42%] w-[42%] text-[#a7d52c]" /></div>}
        {state === 'semifinalResult' && <div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#00b6da]/20 bg-[#00b6da]/5"><Icon name="flag" className="h-[42%] w-[42%] text-[#00b6da]" /></div>}
        {state === 'champion' && <div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#a7d52c]/20 bg-[#a7d52c]/5 shadow-[0_0_80px_rgba(167,213,44,.08)]"><Icon name="trophy" className="h-[48%] w-[48%] text-[#a7d52c]" /></div>}
      </div>

      {(isQuiz || state === 'lobby') && (
        <div className="mt-[clamp(7px,1.2vh,14px)] flex h-[clamp(48px,7vh,64px)] shrink-0 items-center justify-between rounded-2xl border border-[#00b6da]/14 bg-[#06162f]/65 px-4">
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full border border-[#00b6da]/30 text-[#00b6da]"><Icon name="flag" className="h-4 w-4" /></div><div><div className="text-[10px] text-white/50">Próxima etapa</div><div className="font-display text-sm font-bold text-[#a7d52c]">Semifinais</div></div></div>
        </div>
      )}

      <PrimaryAction state={state} setState={setState} />
    </section>
  )
}

function WaveDecoration() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[24%] w-full opacity-50" viewBox="0 0 1600 320" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="dots-cyan" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#00b6da" /></pattern>
        <pattern id="dots-lime" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#a7d52c" /></pattern>
      </defs>
      <path d="M0 245 C240 125 390 315 650 214 C900 116 1025 40 1600 125 L1600 320 L0 320 Z" fill="url(#dots-cyan)" opacity=".7" />
      <path d="M0 280 C225 160 400 315 670 246 C870 196 970 132 1210 195 C1370 236 1480 218 1600 175" fill="none" stroke="url(#dots-lime)" strokeWidth="32" strokeDasharray="2 14" opacity=".65" />
    </svg>
  )
}

export function PresenterVisualPreviewPage() {
  const [state, setState] = useState<PreviewState>('quiz')
  const sidebar = state === 'semifinal' || state === 'semifinalResult'
    ? <MatchSidebar />
    : state === 'final' || state === 'champion'
      ? <MatchSidebar final />
      : <RankingPanel />

  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#020d23] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(23,77,145,.23),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
      <WaveDecoration />

      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[1800px] grid-rows-[auto_auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(10px,1.7vh,22px)]">
        <BrandHeader />

        <div className="relative z-20 flex h-[clamp(42px,6.4vh,56px)] shrink-0 items-center justify-end gap-2 text-xs">
          <label htmlFor="preview-state" className="text-white/45">Prévia visual:</label>
          <select id="preview-state" value={state} onChange={(event) => setState(event.target.value as PreviewState)} className="h-9 rounded-lg border border-white/12 bg-[#071936] px-3 text-sm text-white outline-none focus:border-[#00b6da]">
            {stateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="relative z-10 grid min-h-0 gap-[clamp(10px,1.2vw,20px)] lg:grid-cols-[minmax(0,1.85fr)_minmax(340px,.95fr)]">
          <MainStage state={state} setState={setState} />
          {sidebar}
        </div>
      </div>
    </main>
  )
}
