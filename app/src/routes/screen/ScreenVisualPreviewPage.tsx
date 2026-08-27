import { type ReactNode, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type ScreenState =
  | 'lobby'
  | 'prepare'
  | 'question'
  | 'reveal'
  | 'ranking'
  | 'paused'
  | 'semifinal'
  | 'semifinalResult'
  | 'final'
  | 'champion'

const states: Array<{ value: ScreenState; label: string }> = [
  { value: 'lobby', label: 'Lobby' },
  { value: 'prepare', label: 'Prepare-se' },
  { value: 'question', label: 'Pergunta' },
  { value: 'reveal', label: 'Resposta' },
  { value: 'ranking', label: 'Ranking' },
  { value: 'paused', label: 'Pausado' },
  { value: 'semifinal', label: 'Semifinais' },
  { value: 'semifinalResult', label: 'Finalistas' },
  { value: 'final', label: 'Final' },
  { value: 'champion', label: 'Campeão' },
]

const topRanking = [
  { position: 1, name: 'Ana Martins', score: 9860 },
  { position: 2, name: 'João Pedro', score: 9420 },
  { position: 3, name: 'Marcos Silva', score: 9150 },
  { position: 4, name: 'Carla Souza', score: 8780 },
  { position: 5, name: 'Pedro Lima', score: 7980 },
]

const options = [
  { key: 'A', label: 'Tecnologia aplicada sem mudança de processo' },
  { key: 'B', label: 'Design Thinking' },
  { key: 'C', label: 'Automação sem participação do usuário' },
  { key: 'D', label: 'Padronização de todas as soluções' },
]

function BrandHeader() {
  return (
    <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-white/10 pb-[clamp(8px,1.25vh,16px)]">
      <div className="font-display text-[clamp(1.35rem,2vw,2.35rem)] font-extrabold tracking-[-0.045em]">
        <span className="text-[#a7d52c]">Rota de </span><span className="text-white">Inovação</span>
      </div>
      <div className="flex items-center gap-[clamp(10px,1.2vw,18px)]">
        <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-[clamp(28px,4.4vh,44px)] w-auto object-contain" />
        <div className="h-[clamp(26px,4vh,40px)] w-px bg-white/28" />
        <img src="/brand/enova.png" alt="Enova" className="h-[clamp(25px,4vh,40px)] w-auto object-contain" />
      </div>
      <div className="absolute -bottom-px left-0 h-px w-[42%] bg-gradient-to-r from-[#a7d52c] via-[#6bd27f] to-[#00b6da]" />
    </header>
  )
}

function WaveDecoration() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[30%] w-full opacity-60" viewBox="0 0 1600 330" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="screen-cyan-dots" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.45" fill="#00b6da" /></pattern>
        <pattern id="screen-lime-dots" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.45" fill="#a7d52c" /></pattern>
      </defs>
      <path d="M-40 275 C190 105 365 335 660 218 C920 115 1090 32 1650 128 L1650 350 L-40 350 Z" fill="url(#screen-cyan-dots)" opacity=".72" />
      <path d="M-20 302 C190 175 395 327 680 260 C900 208 1010 142 1240 200 C1395 240 1505 224 1640 183" fill="none" stroke="url(#screen-lime-dots)" strokeWidth="34" strokeDasharray="2 14" opacity=".75" />
    </svg>
  )
}

function PreviewSelector({ state, setState }: { state: ScreenState; setState: (value: ScreenState) => void }) {
  return (
    <div className="absolute right-[clamp(14px,2.3vw,40px)] top-[clamp(72px,10.5vh,104px)] z-30 flex items-center gap-2 rounded-xl border border-white/10 bg-[#04132d]/78 px-3 py-2 text-xs backdrop-blur-md">
      <span className="text-white/40">Prévia:</span>
      <select value={state} onChange={(event) => setState(event.target.value as ScreenState)} className="bg-transparent text-sm font-semibold text-white outline-none">
        {states.map((item) => <option key={item.value} value={item.value} className="bg-[#071936]">{item.label}</option>)}
      </select>
    </div>
  )
}

function StatusPill({ children, tone = 'lime' }: { children: ReactNode; tone?: 'lime' | 'cyan' | 'orange' }) {
  const toneClass = tone === 'cyan'
    ? 'text-[#55d7ef] border-[#00b6da]/25 bg-[#00b6da]/8'
    : tone === 'orange'
      ? 'text-[#ffc56e] border-[#ffb547]/25 bg-[#ffb547]/8'
      : 'text-[#c2e94a] border-[#a7d52c]/25 bg-[#a7d52c]/8'
  return <div className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[clamp(10px,.8vw,13px)] font-bold uppercase tracking-[.16em] ${toneClass}`}>{children}</div>
}

function CircularTimer({ seconds = 8, total = 12, mode = 'question' }: { seconds?: number; total?: number; mode?: 'question' | 'prepare' | 'paused' }) {
  const radius = 106
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(1, seconds / Math.max(total, 1)))
  const label = mode === 'prepare' ? 'Prepare-se' : mode === 'paused' ? 'Pausado' : 'Tempo restante'
  const valueColor = mode === 'paused' ? '#ffb547' : '#a7d52c'

  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[min(290px,30vh)] place-items-center">
      <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="130" cy="130" r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12" />
        <circle
          cx="130"
          cy="130"
          r={radius}
          fill="none"
          stroke={valueColor}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          style={{ filter: `drop-shadow(0 0 10px ${mode === 'paused' ? 'rgba(255,181,71,.35)' : 'rgba(167,213,44,.45)'})` }}
        />
        <circle cx="130" cy="130" r="122" fill="none" stroke="rgba(0,182,218,.28)" strokeWidth="1" strokeDasharray="2 9" />
      </svg>
      <div className="relative text-center">
        <div className="mb-2 text-[clamp(.72rem,.8vw,.9rem)] font-semibold uppercase tracking-[0.24em] text-[#00b6da]">{label}</div>
        <div className="font-display text-[clamp(4rem,7vw,6.5rem)] font-extrabold leading-none tracking-[-0.06em]" style={{ color: valueColor }}>
          {seconds}<span className="ml-1 text-[0.35em]">s</span>
        </div>
      </div>
    </div>
  )
}

function LobbyScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)] items-center gap-[clamp(26px,4vw,72px)]">
      <div className="min-w-0 pl-[clamp(8px,2vw,28px)]">
        <StatusPill>Aguardando participantes</StatusPill>
        <h1 className="mt-[clamp(14px,2.6vh,26px)] font-display text-[clamp(3rem,6.4vw,7rem)] font-extrabold leading-[.92] tracking-[-.06em] text-white">O jogo vai<br/><span className="text-[#a7d52c]">começar!</span></h1>
        <p className="mt-[clamp(14px,2.5vh,24px)] max-w-3xl text-[clamp(1rem,1.6vw,1.7rem)] font-medium leading-snug text-white/68">Entre pelo celular, escolha seu nome e prepare-se para a Rota de Inovação.</p>
        <div className="mt-[clamp(20px,3.5vh,34px)] flex items-center gap-4">
          <div className="font-display text-[clamp(2rem,4vw,4.2rem)] font-extrabold leading-none text-[#a7d52c]">47</div>
          <div className="text-[clamp(.9rem,1.1vw,1.2rem)] leading-tight text-white/70">participantes<br/><span className="font-semibold text-white">conectados</span></div>
        </div>
      </div>
      <div className="justify-self-center rounded-[28px] border border-white/12 bg-white/[.055] p-[clamp(16px,2.3vw,28px)] shadow-[0_0_60px_rgba(0,182,218,.08)] backdrop-blur-xl">
        <div className="rounded-2xl bg-white p-[clamp(12px,1.5vw,18px)]">
          <QRCodeSVG value="https://inovacao.exemplo.com" size={220} style={{ width: 'min(25vw,27vh)', height: 'auto', display: 'block' }} fgColor="#07152f" bgColor="#ffffff" />
        </div>
        <div className="mt-4 text-center text-[clamp(.8rem,1vw,1.05rem)] font-semibold text-white/75">Aponte a câmera e participe</div>
      </div>
    </section>
  )
}

function PrepareScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 place-items-center text-center">
      <div>
        <StatusPill tone="cyan">Próxima pergunta</StatusPill>
        <div className="mt-[clamp(18px,3vh,34px)] text-[clamp(1rem,1.8vw,2rem)] font-semibold uppercase tracking-[.28em] text-white/55">Prepare-se</div>
        <div className="mt-[clamp(10px,1.5vh,18px)]"><CircularTimer seconds={3} total={3} mode="prepare" /></div>
      </div>
    </section>
  )
}

function QuestionScreen({ semifinal = false, final = false }: { semifinal?: boolean; final?: boolean }) {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(230px,28vh)] items-center gap-[clamp(16px,2vw,34px)] px-[clamp(8px,1.4vw,22px)]">
      <div className="min-w-0">
        <div className="mb-[clamp(10px,1.6vh,18px)] flex items-center justify-between gap-6">
          <div>
            <div className="text-[clamp(.75rem,.9vw,1rem)] font-bold uppercase tracking-[.2em] text-[#00b6da]">{final ? 'Grande Final' : semifinal ? 'Semifinais' : 'Quiz Coletivo'}</div>
            <div className="mt-1 font-display text-[clamp(1.05rem,1.7vw,1.7rem)] font-bold text-white">Pergunta 06 <span className="font-medium text-white/45">de 10</span></div>
          </div>
          <StatusPill tone={final ? 'orange' : 'lime'}>{final ? 'Disputa decisiva' : semifinal ? 'Pergunta sincronizada' : 'Ao vivo'}</StatusPill>
        </div>

        <h1 className="max-w-[1100px] font-display text-[clamp(1.8rem,3.1vw,3.65rem)] font-extrabold leading-[1.06] tracking-[-.04em] text-white">Qual abordagem ajuda a compreender necessidades reais antes de desenvolver uma solução?</h1>

        <div className="mt-[clamp(14px,2.3vh,26px)] grid min-h-0 grid-cols-2 gap-[clamp(8px,1vw,14px)]">
          {options.map((option) => (
            <div key={option.key} className="flex min-h-[clamp(58px,8.4vh,90px)] items-center gap-[clamp(12px,1.4vw,20px)] rounded-[20px] border border-white/10 bg-white/[.045] px-[clamp(14px,1.8vw,24px)]">
              <div className="grid h-[clamp(38px,4vw,54px)] w-[clamp(38px,4vw,54px)] shrink-0 place-items-center rounded-2xl border border-[#00b6da]/25 bg-[#00b6da]/8 font-display text-[clamp(1rem,1.45vw,1.5rem)] font-extrabold text-[#56d8ef]">{option.key}</div>
              <div className="text-[clamp(.9rem,1.2vw,1.35rem)] font-semibold leading-snug text-white/88">{option.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="justify-self-center"><CircularTimer seconds={8} total={12} /></div>
    </section>
  )
}

function RevealScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 place-items-center px-[clamp(10px,3vw,50px)] text-center">
      <div className="w-full max-w-6xl">
        <StatusPill tone="cyan">Resposta revelada</StatusPill>
        <div className="mt-[clamp(18px,3vh,32px)] text-[clamp(1rem,1.6vw,1.8rem)] font-semibold uppercase tracking-[.23em] text-white/48">Resposta correta</div>
        <div className="mx-auto mt-[clamp(12px,2vh,20px)] grid h-[clamp(76px,12vh,118px)] w-[clamp(76px,12vh,118px)] place-items-center rounded-[28px] bg-[#a7d52c] font-display text-[clamp(2.7rem,6vw,5.5rem)] font-extrabold leading-none text-[#07152f] shadow-[0_0_55px_rgba(167,213,44,.22)]">B</div>
        <h1 className="mt-[clamp(14px,2.5vh,26px)] font-display text-[clamp(2.6rem,6vw,6.5rem)] font-extrabold leading-none tracking-[-.055em] text-white">Design Thinking</h1>
        <div className="mt-[clamp(16px,3vh,32px)] inline-flex items-baseline gap-3 rounded-2xl border border-white/10 bg-white/[.045] px-6 py-3">
          <span className="font-display text-[clamp(2rem,3.3vw,3.5rem)] font-extrabold text-[#a7d52c]">64%</span>
          <span className="text-[clamp(.9rem,1.2vw,1.3rem)] font-medium text-white/68">dos participantes acertaram</span>
        </div>
      </div>
    </section>
  )
}

function RankingScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,.8fr)_minmax(420px,1.2fr)] items-center gap-[clamp(28px,5vw,80px)] px-[clamp(8px,2vw,30px)]">
      <div>
        <StatusPill>Classificação ao vivo</StatusPill>
        <h1 className="mt-[clamp(14px,2.2vh,24px)] font-display text-[clamp(3rem,6.6vw,7rem)] font-extrabold leading-[.92] tracking-[-.06em] text-white">Ranking</h1>
        <p className="mt-[clamp(12px,2vh,22px)] max-w-xl text-[clamp(1rem,1.45vw,1.55rem)] leading-snug text-white/58">Os quatro primeiros avançam para as semifinais.</p>
      </div>
      <div className="space-y-[clamp(5px,.8vh,9px)]">
        {topRanking.map((item) => (
          <div key={item.position}>
            <div className={`grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border px-[clamp(14px,1.6vw,22px)] py-[clamp(8px,1.3vh,14px)] ${item.position <= 4 ? 'border-[#a7d52c]/24 bg-[#a7d52c]/8' : 'border-white/9 bg-white/[.035]'}`}>
              <div className={`grid h-10 w-10 place-items-center rounded-xl font-display text-lg font-extrabold ${item.position <= 4 ? 'bg-[#a7d52c]/18 text-[#bde748]' : 'bg-white/6 text-white/70'}`}>{item.position}</div>
              <div className="truncate font-display text-[clamp(1rem,1.35vw,1.4rem)] font-bold text-white">{item.name}</div>
              <div className="font-display text-[clamp(1rem,1.3vw,1.35rem)] font-bold tabular-nums text-[#a7d52c]">{item.score.toLocaleString('pt-BR')}</div>
            </div>
            {item.position === 4 && <div className="my-[clamp(4px,.7vh,8px)] flex items-center gap-3 text-[9px] font-extrabold uppercase tracking-[.18em] text-[#a7d52c]"><div className="h-px flex-1 border-t border-dashed border-[#a7d52c]/55"/>Corte para semifinal<div className="h-px flex-1 border-t border-dashed border-[#a7d52c]/55"/></div>}
          </div>
        ))}
      </div>
    </section>
  )
}

function PausedScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(230px,28vh)] items-center gap-[clamp(20px,4vw,64px)] px-[clamp(8px,2vw,28px)]">
      <div>
        <StatusPill tone="orange">Jogo pausado</StatusPill>
        <h1 className="mt-[clamp(16px,2.5vh,28px)] font-display text-[clamp(3.2rem,7vw,7.5rem)] font-extrabold leading-[.9] tracking-[-.065em] text-white">Voltamos<br/><span className="text-[#ffb547]">em instantes</span></h1>
        <p className="mt-[clamp(16px,2.5vh,26px)] text-[clamp(1rem,1.5vw,1.65rem)] text-white/60">A dinâmica continuará exatamente de onde parou.</p>
      </div>
      <div className="justify-self-center"><CircularTimer seconds={8} total={12} mode="paused" /></div>
    </section>
  )
}

function SemifinalBoard() {
  const matches = [
    { title: 'Semifinal 1', a: 'Ana Martins', scoreA: 3, b: 'Carla Souza', scoreB: 2 },
    { title: 'Semifinal 2', a: 'João Pedro', scoreA: 1, b: 'Marcos Silva', scoreB: 3 },
  ]
  return (
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-[clamp(8px,1.8vw,24px)]">
      <div className="mb-[clamp(12px,2vh,20px)] text-center">
        <StatusPill tone="cyan">Semifinais ao vivo</StatusPill>
        <h1 className="mt-[clamp(10px,1.8vh,18px)] font-display text-[clamp(2.7rem,5.6vw,5.8rem)] font-extrabold leading-none tracking-[-.06em] text-white">Duas vagas na final</h1>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 items-stretch gap-[clamp(16px,2vw,30px)] pb-[clamp(6px,1vh,12px)]">
        {matches.map((match) => (
          <div key={match.title} className="flex min-h-0 flex-col justify-center rounded-[30px] border border-white/10 bg-[#071936]/65 p-[clamp(18px,2.2vw,30px)] backdrop-blur-xl">
            <div className="text-center text-[clamp(.7rem,.9vw,1rem)] font-extrabold uppercase tracking-[.24em] text-[#00b6da]">{match.title}</div>
            <div className="mt-[clamp(12px,2vh,24px)] grid grid-cols-[1fr_auto] items-center gap-4 border-b border-white/9 pb-[clamp(12px,2vh,22px)]"><div className="font-display text-[clamp(1.25rem,2vw,2.15rem)] font-bold text-white">{match.a}</div><div className="font-display text-[clamp(2.4rem,5vw,5rem)] font-extrabold text-[#a7d52c]">{match.scoreA}</div></div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 pt-[clamp(12px,2vh,22px)]"><div className="font-display text-[clamp(1.25rem,2vw,2.15rem)] font-bold text-white">{match.b}</div><div className="font-display text-[clamp(2.4rem,5vw,5rem)] font-extrabold text-[#a7d52c]">{match.scoreB}</div></div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SemifinalResultScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 place-items-center text-center">
      <div className="w-full max-w-6xl">
        <StatusPill>Semifinais concluídas</StatusPill>
        <h1 className="mt-[clamp(16px,3vh,30px)] font-display text-[clamp(3rem,7vw,7.5rem)] font-extrabold leading-[.9] tracking-[-.065em] text-white">Temos nossos<br/><span className="text-[#a7d52c]">finalistas</span></h1>
        <div className="mt-[clamp(20px,4vh,42px)] flex items-center justify-center gap-[clamp(18px,3vw,44px)]">
          <div className="rounded-[24px] border border-[#a7d52c]/24 bg-[#a7d52c]/8 px-[clamp(20px,3vw,42px)] py-[clamp(12px,2vh,22px)] font-display text-[clamp(1.35rem,2.5vw,2.7rem)] font-bold text-white">Ana Martins</div>
          <div className="font-display text-[clamp(1.5rem,3vw,3.2rem)] font-extrabold text-[#00b6da]">×</div>
          <div className="rounded-[24px] border border-[#a7d52c]/24 bg-[#a7d52c]/8 px-[clamp(20px,3vw,42px)] py-[clamp(12px,2vh,22px)] font-display text-[clamp(1.35rem,2.5vw,2.7rem)] font-bold text-white">Marcos Silva</div>
        </div>
      </div>
    </section>
  )
}

function ChampionScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 place-items-center text-center">
      <div className="w-full max-w-6xl">
        <div className="mx-auto grid h-[clamp(66px,10vh,104px)] w-[clamp(66px,10vh,104px)] place-items-center rounded-full border border-[#a7d52c]/28 bg-[#a7d52c]/10 text-[clamp(2rem,5vw,4.8rem)] shadow-[0_0_70px_rgba(167,213,44,.13)]">🏆</div>
        <div className="mt-[clamp(12px,2vh,22px)] text-[clamp(.9rem,1.35vw,1.45rem)] font-extrabold uppercase tracking-[.3em] text-[#00b6da]">Campeão</div>
        <h1 className="mt-[clamp(10px,1.6vh,16px)] font-display text-[clamp(4rem,9vw,9rem)] font-extrabold leading-[.86] tracking-[-.075em] text-[#a7d52c] drop-shadow-[0_0_50px_rgba(167,213,44,.18)]">Marcos Silva</h1>
        <div className="mx-auto mt-[clamp(18px,3vh,32px)] h-px w-[42%] bg-gradient-to-r from-transparent via-[#a7d52c] to-transparent" />
        <p className="mt-[clamp(14px,2.5vh,26px)] text-[clamp(1rem,1.5vw,1.6rem)] font-medium text-white/64">Rota de Inovação · Parabéns!</p>
      </div>
    </section>
  )
}

export function ScreenVisualPreviewPage() {
  const [state, setState] = useState<ScreenState>('question')

  let content: ReactNode
  if (state === 'lobby') content = <LobbyScreen />
  else if (state === 'prepare') content = <PrepareScreen />
  else if (state === 'question') content = <QuestionScreen />
  else if (state === 'reveal') content = <RevealScreen />
  else if (state === 'ranking') content = <RankingScreen />
  else if (state === 'paused') content = <PausedScreen />
  else if (state === 'semifinal') content = <SemifinalBoard />
  else if (state === 'semifinalResult') content = <SemifinalResultScreen />
  else if (state === 'final') content = <QuestionScreen final />
  else content = <ChampionScreen />

  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#020d23] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(23,77,145,.23),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(0,182,218,.09),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
      <WaveDecoration />
      <PreviewSelector state={state} setState={setState} />

      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[1800px] grid-rows-[auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(12px,1.8vh,24px)]">
        <BrandHeader />
        {content}
      </div>
    </main>
  )
}
