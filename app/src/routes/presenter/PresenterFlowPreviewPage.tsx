import { useState } from 'react'
import { PresenterVisualPreviewPage } from './PresenterVisualPreviewPage'

type PresenterStep = 'setup' | 'lobby' | 'running'

const connectedPeople = ['Ana Martins', 'João Pedro', 'Marcos Silva', 'Carla Souza', 'Pedro Lima', 'Bruno Alves']

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

function PlayIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4Z" />
    </svg>
  )
}

function ScreenIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function UsersIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00b6da]" /> O telão abre no Lobby; o Quiz só começa quando você autorizar.
              </div>
            </div>

            <aside className="flex min-h-0 flex-col justify-center rounded-[28px] border border-white/12 bg-[#071936]/88 p-[clamp(20px,2.5vw,30px)] backdrop-blur-xl">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#00b6da]/22 bg-[#00b6da]/7 text-[#00b6da]"><ScreenIcon /></div>
              <h2 className="mt-5 font-display text-[clamp(1.35rem,2vw,2rem)] font-bold text-white">Como funciona</h2>
              <div className="mt-5 space-y-4">
                {[
                  ['1', 'Abra o telão', 'A dinâmica é preparada e o telão abre em outra aba.'],
                  ['2', 'Compartilhe a aba', 'Projete ou compartilhe somente a aba do telão.'],
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

function LobbyScreen({ onStartQuiz, onOpenScreen }: { onStartQuiz: () => void; onOpenScreen: () => void }) {
  return (
    <main className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#020d23] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(23,77,145,.23),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
      <WaveDecoration />

      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[1800px] grid-rows-[auto_auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(10px,1.7vh,22px)]">
        <BrandHeader />

        <div className="relative z-20 flex h-[clamp(44px,6.5vh,58px)] shrink-0 items-center justify-end">
          <button type="button" onClick={onOpenScreen} className="flex items-center gap-2 rounded-xl border border-[#00b6da]/24 bg-[#00b6da]/7 px-4 py-2 text-xs font-bold text-[#5ddcf2] transition hover:bg-[#00b6da]/12">
            <ScreenIcon className="h-4 w-4" /> Abrir telão novamente
          </button>
        </div>

        <div className="relative z-10 grid min-h-0 gap-[clamp(10px,1.2vw,20px)] lg:grid-cols-[minmax(0,1.85fr)_minmax(340px,.95fr)]">
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/78 p-[clamp(14px,2.1vh,26px)] backdrop-blur-xl">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#a7d52c]/24 bg-[#a7d52c]/8 px-3.5 py-1.5 text-[11px] font-bold text-[#c1e944]">
              <span className="h-2 w-2 rounded-full bg-[#a7d52c]" /> Aguardando participantes
            </div>

            <div className="grid min-h-0 flex-1 items-center gap-[clamp(16px,2vw,30px)] lg:grid-cols-[minmax(0,1fr)_minmax(210px,27vh)]">
              <div>
                <h1 className="font-display text-[clamp(3rem,5vw,5.2rem)] font-extrabold leading-[.94] tracking-[-.06em] text-white">Lobby</h1>
                <p className="mt-3 text-[clamp(1rem,1.4vw,1.4rem)] font-medium text-white/65">47 participantes conectados</p>
                <div className="mt-4 h-px w-60 max-w-[45%] bg-gradient-to-r from-[#a7d52c] to-[#00b6da]" />

                <div className="mt-[clamp(18px,3vh,32px)] grid max-w-xl grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/9 bg-white/[.035] p-4">
                    <div className="text-xs text-white/50">Conectados</div>
                    <div className="mt-1 font-display text-[clamp(2rem,3vw,3rem)] font-extrabold leading-none text-[#a7d52c]">47</div>
                  </div>
                  <div className="rounded-2xl border border-white/9 bg-white/[.035] p-4">
                    <div className="text-xs text-white/50">Status</div>
                    <div className="mt-2 text-sm font-semibold text-white">Pronto para iniciar</div>
                  </div>
                </div>
              </div>

              <div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#00b6da]/20 bg-[#00b6da]/5 text-center">
                <div><UsersIcon className="mx-auto mb-2 h-10 w-10 text-[#a7d52c]" /><div className="font-display text-[clamp(3rem,4.5vw,4.5rem)] font-extrabold leading-none text-white">47</div><div className="mt-1.5 text-xs text-white/55">participantes</div></div>
              </div>
            </div>

            <div className="mb-[clamp(8px,1.2vh,14px)] flex h-[clamp(48px,7vh,64px)] shrink-0 items-center rounded-2xl border border-[#00b6da]/14 bg-[#06162f]/65 px-4">
              <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full border border-[#00b6da]/30 text-[#00b6da]"><PlayIcon className="h-4 w-4" /></div><div><div className="text-[10px] text-white/50">Próxima etapa</div><div className="font-display text-sm font-bold text-[#a7d52c]">Quiz coletivo</div></div></div>
            </div>

            <button type="button" onClick={onStartQuiz} className="flex h-[clamp(50px,7vh,64px)] w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-[#a7d52c] px-6 font-display text-[clamp(1rem,1.35vw,1.25rem)] font-extrabold text-[#07152f] shadow-[0_0_34px_rgba(167,213,44,.18)] transition hover:bg-[#b6e33c]">
              <PlayIcon /> Iniciar Quiz
            </button>
          </section>

          <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/88 p-[clamp(12px,1.6vh,20px)] backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-3"><UsersIcon className="h-5 w-5 text-[#a7d52c]" /><h2 className="font-display text-[clamp(1rem,1.4vw,1.25rem)] font-bold text-white">Participantes conectados</h2></div>
            <div className="grid min-h-0 flex-1 grid-rows-6 gap-[clamp(5px,.7vh,9px)]">
              {connectedPeople.map((name, index) => (
                <div key={name} className="grid min-h-0 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/[.028] px-3">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#00b6da]/8 text-[11px] font-bold text-[#5ddcf2]">{index + 1}</div>
                  <div className="truncate text-sm font-medium text-white/88">{name}</div>
                  <span className="h-2 w-2 rounded-full bg-[#a7d52c]" />
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/8 pt-3 text-xs text-white/45">+ 41 participantes conectados</div>
          </aside>
        </div>
      </div>
    </main>
  )
}

export function PresenterFlowPreviewPage() {
  const [step, setStep] = useState<PresenterStep>('setup')

  const openScreen = () => {
    const screenWindow = window.open('/telao-visual', '_blank', 'noopener,noreferrer')
    if (screenWindow) screenWindow.opener = null
  }

  const startDynamic = () => {
    openScreen()
    setStep('lobby')
  }

  if (step === 'setup') return <SetupScreen onStart={startDynamic} />
  if (step === 'lobby') return <LobbyScreen onStartQuiz={() => setStep('running')} onOpenScreen={openScreen} />
  return <PresenterVisualPreviewPage />
}
