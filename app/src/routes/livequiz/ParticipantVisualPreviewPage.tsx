import { type ReactNode, useState } from 'react'

type ParticipantState =
  | 'entry'
  | 'lobby'
  | 'prepare'
  | 'question'
  | 'answered'
  | 'correct'
  | 'wrong'
  | 'qualified'
  | 'spectator'
  | 'semifinal'
  | 'final'
  | 'finish'

const previewStates: Array<{ value: ParticipantState; label: string }> = [
  { value: 'entry', label: 'Entrada' },
  { value: 'lobby', label: 'Lobby' },
  { value: 'prepare', label: 'Prepare-se' },
  { value: 'question', label: 'Pergunta' },
  { value: 'answered', label: 'Resposta registrada' },
  { value: 'correct', label: 'Acertou' },
  { value: 'wrong', label: 'Errou' },
  { value: 'qualified', label: 'Classificado' },
  { value: 'spectator', label: 'Acompanhando' },
  { value: 'semifinal', label: 'Semifinal' },
  { value: 'final', label: 'Final' },
  { value: 'finish', label: 'Resultado final' },
]

const answers = [
  { key: 'A', label: 'Tecnologia sem mudança de processo' },
  { key: 'B', label: 'Design Thinking' },
  { key: 'C', label: 'Automação sem participação do usuário' },
  { key: 'D', label: 'Padronização de todas as soluções' },
]

function MiniBrand() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
      <div className="font-display text-[19px] font-extrabold tracking-[-.045em]">
        <span className="text-[#a7d52c]">Rota de </span>
        <span className="text-white">Inovação</span>
      </div>
      <div className="flex items-center gap-2">
        <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-5 w-auto object-contain" />
        <div className="h-5 w-px bg-white/25" />
        <img src="/brand/enova.png" alt="Enova" className="h-[18px] w-auto object-contain" />
      </div>
    </header>
  )
}

function Dots() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] w-full opacity-40" viewBox="0 0 420 180" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="mobile-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#00b6da" />
        </pattern>
      </defs>
      <path d="M-20 135 C72 72 144 184 230 122 C302 70 344 78 450 104 L450 190 L-20 190 Z" fill="url(#mobile-dots)" />
    </svg>
  )
}

function StatusBadge({ children, tone = 'lime' }: { children: ReactNode; tone?: 'lime' | 'cyan' | 'orange' }) {
  const style = tone === 'cyan'
    ? 'border-[#00b6da]/24 bg-[#00b6da]/8 text-[#5ddcf2]'
    : tone === 'orange'
      ? 'border-[#ffb547]/24 bg-[#ffb547]/8 text-[#ffc36b]'
      : 'border-[#a7d52c]/24 bg-[#a7d52c]/8 text-[#c1e944]'

  return <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] ${style}`}>{children}</div>
}

function SmallTimer({ seconds = 8 }: { seconds?: number }) {
  const r = 24
  const circumference = 2 * Math.PI * r
  return (
    <div className="relative grid h-[62px] w-[62px] shrink-0 place-items-center">
      <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="#a7d52c" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * .31} />
      </svg>
      <span className="font-display text-[23px] font-extrabold leading-none text-[#a7d52c]">{String(seconds).padStart(2, '0')}</span>
    </div>
  )
}

function PrepareCircle() {
  return (
    <div className="relative mx-auto grid h-44 w-44 place-items-center">
      <div className="absolute inset-0 rounded-full border border-[#00b6da]/25" />
      <div className="absolute inset-3 rounded-full border-[8px] border-white/8 border-t-[#a7d52c] border-r-[#a7d52c]" />
      <span className="font-display text-8xl font-extrabold leading-none text-[#a7d52c]">3</span>
    </div>
  )
}

function EntryScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <StatusBadge>Bem-vindo</StatusBadge>
      <h1 className="mt-4 font-display text-[42px] font-extrabold leading-[.95] tracking-[-.055em] text-white">Entre na<br /><span className="text-[#a7d52c]">dinâmica</span></h1>
      <p className="mt-4 text-sm leading-relaxed text-white/58">Digite seu nome como você quer aparecer no ranking.</p>
      <div className="mt-7">
        <label className="mb-2 block text-xs font-semibold text-white/55">Seu nome</label>
        <div className="rounded-2xl border border-white/12 bg-white/[.045] px-4 py-4 text-[15px] font-medium text-white/82">Marcos Silva</div>
      </div>
      <button className="mt-4 rounded-2xl bg-[#a7d52c] px-5 py-4 font-display text-[15px] font-extrabold text-[#07152f] shadow-[0_12px_32px_rgba(167,213,44,.14)]">Entrar na dinâmica</button>
      <div className="mt-5 text-center text-[11px] text-white/38">Um dispositivo por participante</div>
    </div>
  )
}

function LobbyScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full border border-[#a7d52c]/24 bg-[#a7d52c]/8 text-[#a7d52c]">
        <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4 4L19 6" /></svg>
      </div>
      <StatusBadge>Conectado</StatusBadge>
      <h1 className="mt-4 font-display text-[38px] font-extrabold leading-none tracking-[-.05em] text-white">Você está dentro!</h1>
      <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-white/58">Agora é só acompanhar o telão. O quiz começa quando o apresentador liberar.</p>
      <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left">
        <div className="text-[10px] uppercase tracking-[.15em] text-white/38">Participante</div>
        <div className="mt-1 font-display text-lg font-bold text-white">Marcos Silva</div>
      </div>
    </div>
  )
}

function PrepareScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <StatusBadge tone="cyan">Próxima pergunta</StatusBadge>
      <h1 className="mt-5 font-display text-[30px] font-extrabold tracking-[-.04em] text-white">Prepare-se</h1>
      <div className="mt-6"><PrepareCircle /></div>
      <p className="mt-6 text-sm font-medium text-white/48">A pergunta aparece em instantes</p>
    </div>
  )
}

function QuestionScreen({ phase = 'quiz', locked = false }: { phase?: 'quiz' | 'semifinal' | 'final'; locked?: boolean }) {
  const phaseLabel = phase === 'final' ? 'Grande Final' : phase === 'semifinal' ? 'Semifinal' : 'Quiz Coletivo'
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.17em] text-[#00b6da]">{phaseLabel}</div>
          <div className="mt-1 text-xs font-semibold text-white/48">Pergunta 06 de 10</div>
        </div>
        <SmallTimer seconds={8} />
      </div>
      <h1 className="mt-3 font-display text-[21px] font-extrabold leading-[1.15] tracking-[-.035em] text-white">Qual abordagem ajuda a compreender necessidades reais antes de desenvolver uma solução?</h1>
      <div className="mt-4 grid min-h-0 flex-1 grid-rows-4 gap-2.5">
        {answers.map((answer, index) => {
          const selected = locked && index === 1
          return (
            <button key={answer.key} disabled={locked} className={`flex min-h-0 items-center gap-3 rounded-2xl border px-3 text-left transition ${selected ? 'border-[#a7d52c]/55 bg-[#a7d52c]/12' : 'border-white/10 bg-white/[.04]'}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-base font-extrabold ${selected ? 'border-[#a7d52c]/40 bg-[#a7d52c]/14 text-[#c1e944]' : 'border-[#00b6da]/25 bg-[#00b6da]/8 text-[#5ddcf2]'}`}>{answer.key}</span>
              <span className="text-[13px] font-semibold leading-snug text-white/86">{answer.label}</span>
            </button>
          )
        })}
      </div>
      {locked && <div className="mt-3 rounded-xl border border-[#a7d52c]/20 bg-[#a7d52c]/8 px-3 py-2.5 text-center text-xs font-bold text-[#c1e944]">Resposta registrada</div>}
    </div>
  )
}

function ResultScreen({ correct }: { correct: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div className={`grid h-24 w-24 place-items-center rounded-full border ${correct ? 'border-[#a7d52c]/28 bg-[#a7d52c]/9 text-[#a7d52c]' : 'border-[#ff7f71]/25 bg-[#ff7f71]/8 text-[#ff9186]'}`}>
        {correct ? (
          <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4 4L19 6" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-11 w-11" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m7 7 10 10M17 7 7 17" /></svg>
        )}
      </div>
      <h1 className="mt-5 font-display text-[38px] font-extrabold leading-none tracking-[-.05em] text-white">{correct ? 'Mandou bem!' : 'Quase!'}</h1>
      <p className="mt-3 text-sm text-white/55">Resposta correta: <span className="font-bold text-[#a7d52c]">B · Design Thinking</span></p>
      <div className="mt-7 grid w-full grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-[10px] uppercase tracking-[.15em] text-white/38">Pontos</div><div className="mt-1 font-display text-2xl font-extrabold text-[#a7d52c]">{correct ? '+890' : '+0'}</div></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="text-[10px] uppercase tracking-[.15em] text-white/38">Posição</div><div className="mt-1 font-display text-2xl font-extrabold text-white">4º</div></div>
      </div>
      <div className="mt-5 text-xs font-medium text-white/42">Próxima pergunta em instantes</div>
    </div>
  )
}

function QualifiedScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div className="grid h-24 w-24 place-items-center rounded-full border border-[#a7d52c]/28 bg-[#a7d52c]/9 text-[#a7d52c] shadow-[0_0_50px_rgba(167,213,44,.1)]">
        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/></svg>
      </div>
      <StatusBadge>Top 4</StatusBadge>
      <h1 className="mt-4 font-display text-[38px] font-extrabold leading-[.98] tracking-[-.05em] text-white">Você está na<br /><span className="text-[#a7d52c]">semifinal!</span></h1>
      <p className="mt-4 max-w-[290px] text-sm leading-relaxed text-white/58">Fique atento. Quando o apresentador iniciar a etapa, suas próximas respostas valem a vaga na final.</p>
      <div className="mt-7 w-full rounded-2xl border border-[#a7d52c]/18 bg-[#a7d52c]/7 p-4"><div className="text-[10px] uppercase tracking-[.15em] text-white/38">Classificação</div><div className="mt-1 font-display text-[28px] font-extrabold text-[#a7d52c]">4º lugar</div></div>
    </div>
  )
}

function SpectatorScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <StatusBadge tone="cyan">Acompanhe a disputa</StatusBadge>
      <h1 className="mt-4 font-display text-[36px] font-extrabold leading-[.98] tracking-[-.05em] text-white">O jogo continua</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/55">Você encerrou sua participação, mas pode acompanhar as semifinais e a grande final por aqui e pelo telão.</p>
      <div className="mt-7 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-[#00b6da]">Semifinal 1</div><div className="mt-3 flex items-center justify-between"><span className="font-display text-base font-bold text-white">Ana Martins</span><span className="font-display text-2xl font-extrabold text-[#a7d52c]">3</span></div><div className="mt-2 flex items-center justify-between"><span className="font-display text-base font-bold text-white">Carla Souza</span><span className="font-display text-2xl font-extrabold text-white/55">2</span></div></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="text-[10px] font-bold uppercase tracking-[.15em] text-[#00b6da]">Semifinal 2</div><div className="mt-3 flex items-center justify-between"><span className="font-display text-base font-bold text-white">João Pedro</span><span className="font-display text-2xl font-extrabold text-white/55">1</span></div><div className="mt-2 flex items-center justify-between"><span className="font-display text-base font-bold text-white">Marcos Silva</span><span className="font-display text-2xl font-extrabold text-[#a7d52c]">3</span></div></div>
      </div>
    </div>
  )
}

function FinishScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <StatusBadge tone="cyan">Dinâmica concluída</StatusBadge>
      <div className="mt-5 text-[11px] font-bold uppercase tracking-[.2em] text-white/40">Sua colocação final</div>
      <div className="mt-2 font-display text-[76px] font-extrabold leading-none tracking-[-.07em] text-[#a7d52c]">4º</div>
      <div className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[.04] p-5"><div className="text-[10px] uppercase tracking-[.15em] text-white/38">Pontuação</div><div className="mt-1 font-display text-[34px] font-extrabold text-white">8.780</div></div>
      <p className="mt-5 text-sm leading-relaxed text-white/55">Obrigado por participar da Rota de Inovação.</p>
    </div>
  )
}

function PhoneScreen({ state }: { state: ParticipantState }) {
  let content: ReactNode
  if (state === 'entry') content = <EntryScreen />
  else if (state === 'lobby') content = <LobbyScreen />
  else if (state === 'prepare') content = <PrepareScreen />
  else if (state === 'question') content = <QuestionScreen />
  else if (state === 'answered') content = <QuestionScreen locked />
  else if (state === 'correct') content = <ResultScreen correct />
  else if (state === 'wrong') content = <ResultScreen correct={false} />
  else if (state === 'qualified') content = <QualifiedScreen />
  else if (state === 'spectator') content = <SpectatorScreen />
  else if (state === 'semifinal') content = <QuestionScreen phase="semifinal" />
  else if (state === 'final') content = <QuestionScreen phase="final" />
  else content = <FinishScreen />

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#020d23] px-5 pb-5 pt-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_4%,rgba(42,87,160,.27),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(0,182,218,.1),transparent_25%),linear-gradient(180deg,#04122d_0%,#020d23_100%)]" />
      <Dots />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <MiniBrand />
        <div className="min-h-0 flex-1 pt-4">{content}</div>
      </div>
    </div>
  )
}

export function ParticipantVisualPreviewPage() {
  const [state, setState] = useState<ParticipantState>('question')

  return (
    <main className="relative grid h-[100dvh] max-h-[100dvh] overflow-hidden place-items-center bg-[#010817] px-4 py-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(19,72,136,.24),transparent_34%),linear-gradient(180deg,#06122b_0%,#010817_100%)]" />

      <div className="absolute right-5 top-5 z-30 hidden items-center gap-2 rounded-xl border border-white/10 bg-[#071936]/85 px-3 py-2 text-xs backdrop-blur-md sm:flex">
        <span className="text-white/42">Prévia:</span>
        <select value={state} onChange={(event) => setState(event.target.value as ParticipantState)} className="bg-transparent text-sm font-semibold text-white outline-none">
          {previewStates.map((item) => <option key={item.value} value={item.value} className="bg-[#071936]">{item.label}</option>)}
        </select>
      </div>

      <div className="relative z-10 h-[min(92dvh,820px)] w-[min(100%,390px)] overflow-hidden rounded-[34px] border border-white/14 bg-[#020d23] shadow-[0_28px_90px_rgba(0,0,0,.55)] sm:ring-[10px] sm:ring-[#060b16]">
        <PhoneScreen state={state} />
      </div>

      <div className="absolute inset-x-4 bottom-3 z-30 flex justify-center sm:hidden">
        <select value={state} onChange={(event) => setState(event.target.value as ParticipantState)} className="rounded-xl border border-white/10 bg-[#071936]/92 px-3 py-2 text-xs font-semibold text-white outline-none backdrop-blur-md">
          {previewStates.map((item) => <option key={item.value} value={item.value} className="bg-[#071936]">{item.label}</option>)}
        </select>
      </div>
    </main>
  )
}
