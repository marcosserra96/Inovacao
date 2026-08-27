import { useState } from 'react'
import { PresenterVisualPreviewPage } from './PresenterVisualPreviewPage'

function BrandHeader() {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 pb-[clamp(10px,1.7vh,20px)]">
      <div className="flex min-w-0 items-center gap-[clamp(12px,1.4vw,20px)]">
        <div className="font-display text-[clamp(1.45rem,2.15vw,2.55rem)] font-extrabold tracking-[-0.04em]">
          <span className="text-[#a7d52c]">Rota de </span>
          <span className="text-white">Inovação</span>
        </div>
        <div className="hidden h-9 w-px bg-white/30 sm:block" />
        <div className="hidden text-sm font-medium text-white/75 sm:block md:text-base">Painel do Apresentador</div>
      </div>
      <div className="flex shrink-0 items-center gap-[clamp(12px,1.2vw,18px)]">
        <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-[clamp(28px,4.2vh,42px)] w-auto object-contain" />
        <div className="h-[clamp(26px,3.8vh,38px)] w-px bg-white/30" />
        <img src="/brand/enova.png" alt="Enova" className="h-[clamp(26px,3.9vh,39px)] w-auto object-contain" />
      </div>
      <div className="absolute -bottom-px left-0 h-px w-[42%] bg-gradient-to-r from-[#a7d52c] via-[#6bd27f] to-[#00b6da]" />
    </header>
  )
}

function WaveDecoration() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[28%] w-full opacity-50" viewBox="0 0 1600 320" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="entry-dots-cyan" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#00b6da" /></pattern>
        <pattern id="entry-dots-lime" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#a7d52c" /></pattern>
      </defs>
      <path d="M0 245 C240 125 390 315 650 214 C900 116 1025 40 1600 125 L1600 320 L0 320 Z" fill="url(#entry-dots-cyan)" opacity=".7" />
      <path d="M0 280 C225 160 400 315 670 246 C870 196 970 132 1210 195 C1370 236 1480 218 1600 175" fill="none" stroke="url(#entry-dots-lime)" strokeWidth="32" strokeDasharray="2 14" opacity=".65" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4Z" />
    </svg>
  )
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function SetupScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#020d23] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(23,77,145,.23),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
      <WaveDecoration />

      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[1800px] grid-rows-[auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(10px,1.7vh,22px)]">
        <BrandHeader />

        <section className="relative z-10 grid min-h-0 place-items-center py-[clamp(18px,3vh,40px)]">
          <div className="grid w-full max-w-5xl gap-[clamp(14px,2vw,24px)] lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
            <div className="flex min-h-0 flex-col justify-center rounded-[28px] border border-white/12 bg-[#071936]/78 p-[clamp(24px,4vw,48px)] backdrop-blur-xl">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#a7d52c]/24 bg-[#a7d52c]/8 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#c1e944]">
                <span className="h-2 w-2 rounded-full bg-[#a7d52c]" /> Tudo pronto
              </div>

              <h1 className="mt-[clamp(16px,2.5vh,28px)] max-w-3xl font-display text-[clamp(2.6rem,5.1vw,5.6rem)] font-extrabold leading-[.94] tracking-[-.06em] text-white">
                Inicie a <span className="text-[#a7d52c]">dinâmica</span>
              </h1>
              <p className="mt-[clamp(14px,2.2vh,24px)] max-w-2xl text-[clamp(1rem,1.3vw,1.3rem)] leading-relaxed text-white/64">
                O telão será aberto automaticamente em uma nova aba. Compartilhe essa aba no projetor ou na reunião e continue controlando toda a dinâmica por aqui.
              </p>

              <button type="button" onClick={onStart} className="mt-[clamp(24px,4vh,42px)] flex h-[clamp(54px,7.5vh,68px)] w-full max-w-2xl items-center justify-center gap-3 rounded-2xl bg-[#a7d52c] px-6 font-display text-[clamp(1rem,1.4vw,1.3rem)] font-extrabold text-[#07152f] shadow-[0_0_38px_rgba(167,213,44,.18)] transition hover:bg-[#b6e33c] focus:outline-none focus:ring-2 focus:ring-[#00b6da] focus:ring-offset-2 focus:ring-offset-[#07152f]">
                <PlayIcon /> Iniciar dinâmica
              </button>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/42">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00b6da]" /> A dinâmica permanece em Lobby até você iniciar o Quiz.
              </div>
            </div>

            <aside className="flex min-h-0 flex-col justify-center rounded-[28px] border border-white/12 bg-[#071936]/88 p-[clamp(20px,2.5vw,30px)] backdrop-blur-xl">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#00b6da]/22 bg-[#00b6da]/7 text-[#00b6da]"><ScreenIcon /></div>
              <h2 className="mt-5 font-display text-[clamp(1.35rem,2vw,2rem)] font-bold text-white">Como funciona</h2>
              <div className="mt-5 space-y-4">
                {[
                  ['1', 'Abra o telão', 'O botão ao lado abre a tela que será compartilhada.'],
                  ['2', 'Compartilhe a aba', 'Projete ou compartilhe apenas a aba do telão.'],
                  ['3', 'Controle por aqui', 'Quiz, pausa, semifinais e final ficam nesta tela.'],
                ].map(([step, title, text]) => (
                  <div key={step} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#a7d52c]/12 font-display text-xs font-bold text-[#c1e944]">{step}</div>
                    <div><div className="text-sm font-semibold text-white">{title}</div><div className="mt-1 text-xs leading-relaxed text-white/48">{text}</div></div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}

export function PresenterFlowPreviewPage() {
  const [started, setStarted] = useState(false)

  const startDynamic = () => {
    const screenWindow = window.open('/telao-visual', '_blank', 'noopener,noreferrer')
    if (screenWindow) screenWindow.opener = null
    setStarted(true)
  }

  if (started) return <PresenterVisualPreviewPage />
  return <SetupScreen onStart={startDynamic} />
}
