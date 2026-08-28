import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLiveDynamic } from '@/hooks/useLiveDynamic'
import { useToast } from '@/contexts/ToastContext'

type Props = { sessionId: string; onOpenScreen?: () => void; onFinish?: () => void }

type FlowState = 'lobby' | 'prepare' | 'question' | 'reveal' | 'ranking' | 'quiz_result' | 'semifinal_ready' | 'semifinal' | 'semifinal_result' | 'final_ready' | 'final' | 'champion' | 'finished'

function Icon({ name, className = 'h-5 w-5' }: { name: 'users' | 'pause' | 'play' | 'signal' | 'flag' | 'trophy' | 'screen' | 'stop'; className?: string }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths = {
    users: <><path {...c} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle {...c} cx="9" cy="7" r="4"/><path {...c} d="M22 21v-2a4 4 0 0 1-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    pause: <><circle {...c} cx="12" cy="12" r="9"/><path {...c} d="M10 9v6M14 9v6"/></>,
    play: <><circle {...c} cx="12" cy="12" r="9"/><path {...c} d="m10 8 6 4-6 4Z"/></>,
    signal: <><path {...c} d="M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></>,
    flag: <><path {...c} d="M5 21V4"/><path {...c} d="M5 5h10l-1.5 3L15 11H5"/></>,
    trophy: <><path {...c} d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0Z"/><path {...c} d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/></>,
    screen: <><rect {...c} x="3" y="4" width="18" height="13" rx="2"/><path {...c} d="M8 21h8M12 17v4"/></>,
    stop: <><circle {...c} cx="12" cy="12" r="9"/><rect {...c} x="9" y="9" width="6" height="6" rx="1"/></>,
  }
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{paths[name]}</svg>
}

function BrandHeader({ onOpenScreen, onFinish, busy }: { onOpenScreen?: () => void; onFinish?: () => void; busy?: boolean }) {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 pb-[clamp(10px,1.7vh,20px)]">
      <div className="flex min-w-0 items-center gap-[clamp(12px,1.4vw,20px)]">
        <div className="font-display text-[clamp(1.45rem,2.15vw,2.55rem)] font-extrabold tracking-[-0.04em]"><span className="text-[#a7d52c]">Rota de </span><span className="text-white">Inovação</span></div>
        <div className="hidden h-9 w-px bg-white/30 sm:block"/><div className="hidden text-sm font-medium text-white/75 sm:block md:text-base">Painel do Apresentador</div>
      </div>
      <div className="flex items-center gap-2">
        {onOpenScreen && <button type="button" onClick={onOpenScreen} className="hidden items-center gap-2 rounded-xl border border-white/12 bg-white/[.04] px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/[.08] md:flex"><Icon name="screen" className="h-4 w-4"/>Abrir telão</button>}
        {onFinish && <button type="button" disabled={busy} onClick={onFinish} className="hidden items-center gap-2 rounded-xl border border-[#ff7f71]/25 bg-[#ff7f71]/7 px-3 py-2 text-xs font-semibold text-[#ff9a90] hover:bg-[#ff7f71]/12 disabled:opacity-50 md:flex"><Icon name="stop" className="h-4 w-4"/>Finalizar</button>}
        <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-[clamp(28px,4.2vh,42px)] w-auto"/><div className="h-[clamp(26px,3.8vh,38px)] w-px bg-white/30"/><img src="/brand/enova.png" alt="Enova" className="h-[clamp(26px,3.9vh,39px)] w-auto"/>
      </div>
      <div className="absolute -bottom-px left-0 h-px w-[42%] bg-gradient-to-r from-[#a7d52c] via-[#6bd27f] to-[#00b6da]"/>
    </header>
  )
}

function Ring({ seconds, progress = .67, label }: { seconds: number; progress?: number; label?: string }) {
  const radius = 106
  const circumference = 2 * Math.PI * radius
  return <div className="relative mx-auto grid aspect-square w-full max-w-[min(280px,29vh)] place-items-center">
    <svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="130" cy="130" r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12"/><circle cx="130" cy="130" r={radius} fill="none" stroke="#a7d52c" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference*(1-progress)} style={{filter:'drop-shadow(0 0 8px rgba(167,213,44,.45))'}}/><circle cx="130" cy="130" r="122" fill="none" stroke="rgba(0,182,218,.28)" strokeWidth="1" strokeDasharray="2 9"/></svg>
    <div className="relative text-center">{label && <div className="mb-2 text-xs font-semibold uppercase tracking-[.24em] text-[#00b6da]">{label}</div>}<div className="font-display text-[clamp(3.25rem,5.5vw,5.2rem)] font-extrabold leading-none tracking-[-.06em] text-[#a7d52c]">{String(seconds).padStart(2,'0')}</div></div>
  </div>
}

export function PresenterLiveVisualPage({ sessionId, onOpenScreen, onFinish }: Props) {
  const notify = useToast()
  const { session, connected, ranking, answeredCount, answerableCount, answerPercent, remainingSeconds, currentRound } = useLiveDynamic(sessionId)
  const [busy, setBusy] = useState(false)

  const flow = (session?.paused ? 'paused' : session?.flow_state ?? 'lobby') as FlowState | 'paused'
  const top = ranking.slice(0, 10)

  const call = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true)
    const { data, error } = await supabase.rpc(fn as never, args as never)
    setBusy(false)
    if (error) { notify(error.message, 'error'); return null }
    return data
  }

  const action = async () => {
    if (flow === 'lobby') await call('presenter_start_auto_live_quiz', { p_session_id: sessionId })
    else if (flow === 'paused') await call('presenter_resume_current_dynamic', { p_session_id: sessionId })
    else if (['prepare','question','reveal','ranking'].includes(flow)) await call('presenter_pause_current_dynamic', { p_session_id: sessionId })
    else if (flow === 'quiz_result') {
      const selected = await call('presenter_select_live_quiz_finalists', { p_session_id: sessionId }) as any
      if (selected?.needsTiebreak) notify('Há empate no corte. O desempate será tratado na próxima etapa.', 'error')
      else await call('presenter_start_duel_from_live_quiz', { p_session_id: sessionId })
    }
  }

  const finish = async () => {
    if (!window.confirm('Finalizar esta dinâmica? O histórico será mantido, mas participantes e telão verão que a sessão foi encerrada.')) return
    const result = await call('presenter_finish_current_dynamic', { p_session_id: sessionId })
    if (!result) return
    notify('Dinâmica finalizada.')
    onFinish?.()
  }

  const meta = useMemo(() => {
    if (flow === 'lobby') return ['Aguardando participantes','Lobby',`${connected.length} participantes conectados`]
    if (flow === 'prepare') return ['Prepare-se','Quiz Coletivo',`Pergunta ${session?.current_question_number ?? 1} de ${session?.questions_total ?? 0}`]
    if (flow === 'question') return ['Jogo ao vivo','Quiz Coletivo',`Pergunta ${session?.current_question_number ?? 1} de ${session?.questions_total ?? 0}`]
    if (flow === 'reveal') return ['Resposta revelada','Quiz Coletivo',`Pergunta ${session?.current_question_number ?? 1} concluída`]
    if (flow === 'ranking') return ['Ranking do telão','Quiz Coletivo','Próxima pergunta em instantes']
    if (flow === 'paused') return ['Jogo pausado','Dinâmica pausada','Retome quando estiver pronto']
    if (flow === 'quiz_result') return ['Etapa concluída','Quiz concluído','Os 4 semifinalistas serão definidos agora']
    if (flow === 'semifinal') return ['Jogo ao vivo','Semifinais','Disputas sincronizadas']
    if (flow === 'final') return ['Jogo ao vivo','Grande Final','Disputa decisiva']
    if (flow === 'finished') return ['Dinâmica encerrada','Sessão finalizada','O histórico foi salvo']
    return ['Dinâmica ao vivo','Rota de Inovação','']
  }, [flow, connected.length, session?.current_question_number, session?.questions_total])

  const percent = currentRound?.timer_duration_seconds ? Math.max(0, Math.min(1, remainingSeconds/currentRound.timer_duration_seconds)) : .67
  const canPause = ['prepare','question','reveal','ranking'].includes(flow)
  const buttonLabel = flow === 'lobby' ? 'Iniciar Quiz' : flow === 'paused' ? 'Retomar' : canPause ? 'Pausar' : flow === 'quiz_result' ? 'Iniciar Semifinais' : null

  if (!session) return <div className="grid h-[100dvh] place-items-center bg-[#020d23] text-white/70">Carregando dinâmica…</div>

  return <main className="relative h-[100dvh] overflow-hidden bg-[#020d23] text-white">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(23,77,145,.23),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]"/>
    <div className="relative mx-auto grid h-full max-w-[1800px] grid-rows-[auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(10px,1.7vh,22px)]">
      <BrandHeader onOpenScreen={onOpenScreen} onFinish={()=>void finish()} busy={busy}/>
      <div className="grid min-h-0 gap-[clamp(10px,1.2vw,20px)] pt-[clamp(12px,1.8vh,22px)] lg:grid-cols-[minmax(0,1.85fr)_minmax(340px,.95fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/78 p-[clamp(14px,2.1vh,26px)] backdrop-blur-xl">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/14 bg-[#081d3e]/70 px-3.5 py-1.5 text-[11px] font-bold text-[#b8df3f]"><span className={`h-2 w-2 rounded-full ${flow==='paused'?'bg-[#ffb547]':'bg-[#a7d52c]'}`}/>{meta[0]}</div>
          <div className="grid min-h-0 flex-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(210px,28vh)]">
            <div><h1 className="font-display text-[clamp(2.25rem,4.2vw,4.5rem)] font-extrabold leading-[.96] tracking-[-.055em]">{meta[1]}</h1><p className="mt-3 text-[clamp(1rem,1.35vw,1.35rem)] font-medium text-white/72">{meta[2]}</p><div className="mt-3 h-px w-60 max-w-[45%] bg-gradient-to-r from-[#a7d52c] to-[#00b6da]"/>
              {flow==='lobby' && <div className="mt-7 grid max-w-xl grid-cols-2 gap-3"><div className="rounded-2xl border border-white/9 bg-white/[.035] p-4"><div className="text-xs text-white/55">Conectados</div><div className="mt-1 font-display text-4xl font-bold text-[#a7d52c]">{connected.length}</div></div><div className="rounded-2xl border border-white/9 bg-white/[.035] p-4"><div className="text-xs text-white/55">Status</div><div className="mt-2 text-sm font-semibold">Pronto para iniciar</div></div></div>}
              {['prepare','question','reveal','ranking','paused'].includes(flow) && <div className="mt-7 max-w-xl"><div className="mb-2 flex items-end gap-2"><Icon name="users" className="h-7 w-7 text-[#a7d52c]"/><span className="font-display text-4xl font-extrabold text-[#a7d52c]">{answeredCount}</span><span className="pb-1 text-white/70">de {answerableCount} responderam</span></div><div className="flex items-center gap-4"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-[#b2e32c] to-[#8ccf2a]" style={{width:`${answerPercent}%`}}/></div><span className="text-sm font-bold text-[#00b6da]">{answerPercent}%</span></div></div>}
            </div>
            {flow==='lobby' ? <div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#00b6da]/20 bg-[#00b6da]/5"><div className="text-center"><Icon name="users" className="mx-auto mb-2 h-9 w-9 text-[#a7d52c]"/><div className="font-display text-6xl font-extrabold">{connected.length}</div><div className="mt-1 text-xs text-white/55">participantes</div></div></div> : ['prepare','question','reveal','ranking','paused'].includes(flow) ? <Ring seconds={remainingSeconds} progress={percent} label={flow==='prepare'?'Prepare-se':undefined}/> : <div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#a7d52c]/20 bg-[#a7d52c]/5"><Icon name="trophy" className="h-24 w-24 text-[#a7d52c]"/></div>}
          </div>
          <div className="mt-3 flex h-14 items-center rounded-2xl border border-[#00b6da]/14 bg-[#06162f]/65 px-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full border border-[#00b6da]/30 text-[#00b6da]"><Icon name="flag" className="h-4 w-4"/></div><div><div className="text-[10px] text-white/50">Próxima etapa</div><div className="font-display text-sm font-bold text-[#a7d52c]">Semifinais</div></div></div></div>
          {buttonLabel && <button disabled={busy} onClick={action} className="mt-3 flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#a7d52c] font-display text-lg font-extrabold text-[#07152f] disabled:opacity-50"><Icon name={flow==='paused'||flow==='lobby'||flow==='quiz_result'?'play':'pause'} className="h-6 w-6"/>{buttonLabel}</button>}
          <button disabled={busy} onClick={()=>void finish()} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-[#ff7f71]/20 bg-[#ff7f71]/6 text-sm font-bold text-[#ff9a90] md:hidden"><Icon name="stop" className="h-4 w-4"/>Finalizar dinâmica</button>
        </section>
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/88 p-4 backdrop-blur-xl"><div className="mb-3 flex items-center gap-3"><Icon name="trophy" className="h-5 w-5 text-[#a7d52c]"/><h2 className="font-display text-lg font-bold">Ranking ao vivo</h2></div><div className="grid min-h-0 flex-1 gap-1.5">{top.map((item:any,index:number)=><div key={item.participant_id ?? index} className={`grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2.5 ${index<4?'border-[#a7d52c]/28 bg-[#a7d52c]/8':'border-white/8 bg-white/[.025]'}`}><div className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${index<4?'bg-[#a7d52c]/18 text-[#c4eb50]':'bg-white/7'}`}>{index+1}</div><div className="truncate text-sm">{item.display_name}</div><div className={`text-sm font-bold ${index<4?'text-[#b6df3a]':'text-white/78'}`}>{Number(item.total_score ?? 0).toLocaleString('pt-BR')}</div></div>)}</div><div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 text-[11px]"><div className="flex items-center gap-2 font-semibold text-[#b4de36]"><Icon name="users" className="h-4 w-4"/>{connected.length} conectados</div><div className="flex items-center gap-2 text-[#00b6da]"><Icon name="signal" className="h-4 w-4"/>Tempo real</div></div></aside>
      </div>
    </div>
  </main>
}
