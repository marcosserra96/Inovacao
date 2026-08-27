import { useState } from 'react'
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

function StatusPill({ children, tone = 'lime' }: { children: React.ReactNode; tone?: 'lime' | 'cyan' | 'orange' }) {
  const toneClass = tone === 'cyan' ? 'text-[#55d7ef] border-[#00b6da]/25 bg-[#00b6da]/8' : tone === 'orange' ? 'text-[#ffc56e] border-[#ffb547]/25 bg-[#ffb547]/8' : 'text-[#c2e94a] border-[#a7d52c]/25 bg-[#a7d52c]/8'
  return <div className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[clamp(10px,.8vw,13px)] font-bold uppercase tracking-[.16em] ${toneClass}`}>{children}</div>
}

function CircularTimer({ seconds = 8 }: { seconds?: number }) {
  const radius = 43
  const circumference = 2 * Math.PI * radius
  const progress = 0.67

  return (
    <div className="relative grid aspect-square w-[clamp(86px,7.8vw,112px)] shrink-0 place-items-center">
      <svg viewBox="0 0 104 104" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="52" cy="52" r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
        <circle cx="52" cy="52" r="49" fill="none" stroke="rgba(0,182,218,.24)" strokeWidth="1" strokeDasharray="2 7" />
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="#a7d52c"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ filter: 'drop-shadow(0 0 7px rgba(167,213,44,.45))' }}
        />
      </svg>
      <div className="relative flex items-baseline justify-center leading-none">
        <span className="font-display text-[clamp(2rem,3.4vw,3.35rem)] font-extrabold tracking-[-.06em] text-[#a7d52c]">{String(seconds).padStart(2, '0')}</span>
        <span className="ml-0.5 text-[clamp(.65rem,.8vw,.9rem)] font-bold text-[#a7d52c]">s</span>
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
        <div className="mt-[clamp(4px,1vh,10px)] font-display text-[clamp(9rem,28vw,24rem)] font-extrabold leading-[.82] tracking-[-.085em] text-[#a7d52c] drop-shadow-[0_0_45px_rgba(167,213,44,.18)]">3</div>
      </div>
    </section>
  )
}

function QuestionScreen({ semifinal = false, final = false }: { semifinal?: boolean; final?: boolean }) {
  return (
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-[clamp(8px,1.4vw,22px)]">
      <div className="mb-[clamp(10px,1.6vh,18px)] flex items-center justify-between gap-6">
        <div>
          <div className="text-[clamp(.75rem,.9vw,1rem)] font-bold uppercase tracking-[.2em] text-[#00b6da]">{final ? 'Grande Final' : semifinal ? 'Semifinais' : 'Quiz Coletivo'}</div>
          <div className="mt-1 font-display text-[clamp(1.05rem,1.7vw,1.7rem)] font-bold text-white">Pergunta 06 <span className="font-medium text-white/45">de 10</span></div>
        </div>
        <CircularTimer seconds={8} />
      </div>

      <h1 className="max-w-[1450px] font-display text-[clamp(1.8rem,3.35vw,3.9rem)] font-extrabold leading-[1.08] tracking-[-.035em] text-white">Qual abordagem ajuda a compreender necessidades reais antes de desenvolver uma solução?</h1>

      <div className="mt-[clamp(14px,2.5vh,28px)] grid min-h-0 grid-cols-2 gap-[clamp(8px,1vw,14px)]">
        {options.map((option) => (
          <div key={option.key} className="flex min-h-[clamp(58px,8.8vh,94px)] items-center gap-[clamp(12px,1.4vw,20px)] rounded-[20px] border border-white/10 bg-white/[.045] px-[clamp(14px,1.8vw,24px)]">
            <div className="grid h-[clamp(38px,4vw,54px)] w-[clamp(38px,4vw,54px)] shrink-0 place-items-center rounded-2xl border border-[#00b6da]/25 bg-[#00b6da]/8 font-display text-[clamp(1rem,1.45vw,1.5rem)] font-extrabold text-[#56d8ef]">{option.key}</div>
            <div className="text-[clamp(.9rem,1.25vw,1.4rem)] font-semibold leading-snug text-white/88">{option.label}</div>
          </div>
        ))}
      </div>
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
            <div className={`grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border px-[clamp(14px,1.6vw,22px)] py-[clamp(8px,1.3vh,14px)] ${item.position <= 4 ? 'border-[#a7d52c]/24 bg-[#a7d52c]/8' : 'border-white/10 bg-white/[.035]'}`}>
              <div className={`font-display text-[clamp(1.5rem,2.3vw,2.4rem)] font-extrabold ${item.position <= 4 ? 'text-[#a7d52c]' : 'text-white/55'}`}>{item.position}º</div>
              <div className="truncate text-[clamp(1rem,1.5vw,1.6rem)] font-bold text-white">{item.name}</div>
              <div className={`font-display text-[clamp(1rem,1.5vw,1.6rem)] font-extrabold tabular-nums ${item.position <= 4 ? 'text-[#c1e945]' : 'text-white/68'}`}>{item.score.toLocaleString('pt-BR')}</div>
            </div>
            {item.position === 4 && <div className="my-[clamp(4px,.6vh,7px)] flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#a7d52c]"><div className="h-px flex-1 border-t border-dashed border-[#a7d52c]/50"/>Corte para semifinal<div className="h-px flex-1 border-t border-dashed border-[#a7d52c]/50"/></div>}
          </div>
        ))}
      </div>
    </section>
  )
}

function PausedScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 place-items-center text-center">
      <div>
        <StatusPill tone="orange">Jogo pausado</StatusPill>
        <div className="mx-auto mt-[clamp(18px,3vh,30px)] grid h-[clamp(90px,14vh,140px)] w-[clamp(90px,14vh,140px)] place-items-center rounded-full border border-[#ffb547]/25 bg-[#ffb547]/8">
          <div className="flex gap-3"><span className="h-[clamp(34px,5vh,50px)] w-[clamp(10px,1vw,16px)] rounded-full bg-[#ffbf61]"/><span className="h-[clamp(34px,5vh,50px)] w-[clamp(10px,1vw,16px)] rounded-full bg-[#ffbf61]"/></div>
        </div>
        <h1 className="mt-[clamp(15px,2.5vh,26px)] font-display text-[clamp(3rem,7vw,7rem)] font-extrabold leading-none tracking-[-.055em] text-white">Pausa rápida</h1>
        <p className="mt-4 text-[clamp(1rem,1.35vw,1.45rem)] text-white/58">A dinâmica continua em instantes.</p>
      </div>
    </section>
  )
}

function MatchCard({ title, a, aScore, b, bScore, highlight }: { title: string; a: string; aScore: number; b: string; bScore: number; highlight?: boolean }) {
  return (
    <div className={`rounded-[28px] border p-[clamp(16px,2vw,28px)] ${highlight ? 'border-[#a7d52c]/28 bg-[#a7d52c]/7' : 'border-white/10 bg-white/[.04]'}`}>
      <div className="mb-[clamp(10px,1.6vh,16px)] text-center text-[clamp(.75rem,.9vw,1rem)] font-bold uppercase tracking-[.2em] text-[#00b6da]">{title}</div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/9 pb-[clamp(10px,1.5vh,16px)]">
        <div className="truncate font-display text-[clamp(1.3rem,2.1vw,2.25rem)] font-bold text-white">{a}</div><div className="font-display text-[clamp(2rem,3.5vw,3.8rem)] font-extrabold leading-none text-[#a7d52c]">{aScore}</div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 pt-[clamp(10px,1.5vh,16px)]">
        <div className="truncate font-display text-[clamp(1.3rem,2.1vw,2.25rem)] font-bold text-white">{b}</div><div className="font-display text-[clamp(2rem,3.5vw,3.8rem)] font-extrabold leading-none text-[#a7d52c]">{bScore}</div>
      </div>
    </div>
  )
}

function SemifinalScreen() {
  return (
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-[clamp(8px,1.7vw,28px)]">
      <div className="mb-[clamp(12px,2vh,22px)] flex items-end justify-between">
        <div><StatusPill tone="cyan">Etapa eliminatória</StatusPill><h1 className="mt-3 font-display text-[clamp(2.5rem,5vw,5.3rem)] font-extrabold leading-none tracking-[-.055em] text-white">Semifinais</h1></div>
        <div className="text-right"><div className="text-xs uppercase tracking-[.18em] text-white/40">Pergunta</div><div className="font-display text-[clamp(1.5rem,2.6vw,2.8rem)] font-extrabold text-white">04 <span className="text-white/35">/ 05</span></div></div>
      </div>
      <div className="grid grid-cols-2 gap-[clamp(14px,2vw,28px)]">
        <MatchCard title="Semifinal 1" a="Ana Martins" aScore={3} b="Carla Souza" bScore={2} highlight />
        <MatchCard title="Semifinal 2" a="João Pedro" aScore={1} b="Marcos Silva" bScore={3} highlight />
      </div>
      <div className="mt-[clamp(12px,2vh,22px)] rounded-2xl border border-white/9 bg-[#06162f]/68 px-5 py-[clamp(9px,1.3vh,14px)] text-center text-[clamp(.85rem,1.1vw,1.15rem)] text-white/65">As duas semifinais respondem à mesma pergunta ao mesmo tempo.</div>
    </section>
  )
}

function FinalistsScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 place-items-center text-center">
      <div className="w-full max-w-6xl">
        <StatusPill>Classificados</StatusPill>
        <h1 className="mt-[clamp(16px,2.8vh,30px)] font-display text-[clamp(2.4rem,5.8vw,6.2rem)] font-extrabold leading-none tracking-[-.055em] text-white">Temos nossos<br/><span className="text-[#a7d52c]">finalistas</span></h1>
        <div className="mx-auto mt-[clamp(20px,3.5vh,38px)] grid max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-[clamp(18px,3vw,42px)]">
          <div className="rounded-[26px] border border-white/10 bg-white/[.045] px-5 py-[clamp(18px,3vh,30px)] font-display text-[clamp(1.5rem,2.6vw,2.9rem)] font-extrabold text-white">Ana Martins</div>
          <div className="font-display text-[clamp(1.4rem,2vw,2.2rem)] font-bold text-[#00b6da]">×</div>
          <div className="rounded-[26px] border border-white/10 bg-white/[.045] px-5 py-[clamp(18px,3vh,30px)] font-display text-[clamp(1.5rem,2.6vw,2.9rem)] font-extrabold text-white">Marcos Silva</div>
        </div>
      </div>
    </section>
  )
}

function FinalScreen() {
  return (
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-[clamp(8px,2vw,32px)]">
      <div className="text-center"><StatusPill>Grande Final</StatusPill><h1 className="mt-3 font-display text-[clamp(2.4rem,5.2vw,5.5rem)] font-extrabold leading-none tracking-[-.055em] text-white">Tudo se decide agora</h1></div>
      <div className="mx-auto mt-[clamp(18px,3vh,30px)] grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-[clamp(18px,3vw,44px)]">
        <div className="rounded-[30px] border border-[#a7d52c]/22 bg-[#a7d52c]/7 p-[clamp(18px,2.5vw,30px)] text-center"><div className="font-display text-[clamp(1.5rem,2.8vw,3rem)] font-extrabold text-white">Ana Martins</div><div className="mt-3 font-display text-[clamp(3rem,6vw,6.5rem)] font-extrabold leading-none text-[#a7d52c]">3</div></div>
        <div className="font-display text-[clamp(1.8rem,3vw,3.2rem)] font-extrabold text-[#00b6da]">×</div>
        <div className="rounded-[30px] border border-[#a7d52c]/22 bg-[#a7d52c]/7 p-[clamp(18px,2.5vw,30px)] text-center"><div className="font-display text-[clamp(1.5rem,2.8vw,3rem)] font-extrabold text-white">Marcos Silva</div><div className="mt-3 font-display text-[clamp(3rem,6vw,6.5rem)] font-extrabold leading-none text-[#a7d52c]">2</div></div>
      </div>
      <div className="mt-[clamp(12px,2vh,20px)] text-center text-[clamp(.85rem,1.15vw,1.2rem)] font-medium text-white/52">Pergunta 04 de 05</div>
    </section>
  )
}

function ChampionScreen() {
  return (
    <section className="relative z-10 grid min-h-0 flex-1 place-items-center text-center">
      <div>
        <div className="mx-auto grid h-[clamp(90px,15vh,150px)] w-[clamp(90px,15vh,150px)] place-items-center rounded-full border border-[#a7d52c]/28 bg-[#a7d52c]/9 shadow-[0_0_80px_rgba(167,213,44,.15)]">
          <svg viewBox="0 0 24 24" className="h-[55%] w-[55%] text-[#a7d52c]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/></svg>
        </div>
        <div className="mt-[clamp(12px,2vh,22px)] text-[clamp(.9rem,1.3vw,1.4rem)] font-bold uppercase tracking-[.25em] text-white/45">Campeão</div>
        <h1 className="mt-[clamp(8px,1.2vh,14px)] font-display text-[clamp(3.8rem,9vw,9.5rem)] font-extrabold leading-[.9] tracking-[-.07em] text-white">Marcos<br/><span className="text-[#a7d52c]">Silva</span></h1>
        <div className="mt-[clamp(14px,2.4vh,26px)] text-[clamp(1rem,1.5vw,1.6rem)] font-semibold text-white/58">Rota de Inovação</div>
      </div>
    </section>
  )
}

export function ScreenVisualPreviewPage() {
  const [state, setState] = useState<ScreenState>('lobby')

  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#020d23] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(42,87,160,.24),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(0,182,218,.10),transparent_26%),radial-gradient(circle_at_50%_104%,rgba(167,213,44,.07),transparent_34%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
      <WaveDecoration />

      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[1920px] grid-rows-[auto_minmax(0,1fr)] px-[clamp(14px,2.3vw,42px)] py-[clamp(10px,1.6vh,22px)]">
        <BrandHeader />
        <PreviewSelector state={state} setState={setState} />

        {state === 'lobby' && <LobbyScreen />}
        {state === 'prepare' && <PrepareScreen />}
        {state === 'question' && <QuestionScreen />}
        {state === 'reveal' && <RevealScreen />}
        {state === 'ranking' && <RankingScreen />}
        {state === 'paused' && <PausedScreen />}
        {state === 'semifinal' && <SemifinalScreen />}
        {state === 'semifinalResult' && <FinalistsScreen />}
        {state === 'final' && <FinalScreen />}
        {state === 'champion' && <ChampionScreen />}
      </div>
    </main>
  )
}
