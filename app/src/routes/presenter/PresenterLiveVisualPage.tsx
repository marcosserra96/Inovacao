import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLiveDynamic } from '@/hooks/useLiveDynamic'
import { useLiveBracket } from '@/hooks/useLiveBracket'
import { useToast } from '@/contexts/ToastContext'

type Props = { sessionId: string; onOpenScreen?: () => void; onFinish?: () => void }

function Icon({ name, className = 'h-5 w-5' }: { name: 'users' | 'pause' | 'play' | 'trophy' | 'screen' | 'stop'; className?: string }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths = {
    users: <><path {...c} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle {...c} cx="9" cy="7" r="4"/><path {...c} d="M22 21v-2a4 4 0 0 1-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    pause: <><circle {...c} cx="12" cy="12" r="9"/><path {...c} d="M10 9v6M14 9v6"/></>,
    play: <><circle {...c} cx="12" cy="12" r="9"/><path {...c} d="m10 8 6 4-6 4Z"/></>,
    trophy: <><path {...c} d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0Z"/><path {...c} d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/></>,
    screen: <><rect {...c} x="3" y="4" width="18" height="13" rx="2"/><path {...c} d="M8 21h8M12 17v4"/></>,
    stop: <><circle {...c} cx="12" cy="12" r="9"/><rect {...c} x="9" y="9" width="6" height="6" rx="1"/></>,
  }
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true">{paths[name]}</svg>
}

function BrandHeader({ onOpenScreen, onFinish, busy }: { onOpenScreen?: () => void; onFinish?: () => void; busy?: boolean }) {
  return <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 pb-[clamp(10px,1.7vh,20px)]"><div className="flex min-w-0 items-center gap-[clamp(12px,1.4vw,20px)]"><div className="font-display text-[clamp(1.45rem,2.15vw,2.55rem)] font-extrabold tracking-[-0.04em]"><span className="text-[#a7d52c]">Rota de </span><span className="text-white">Inovação</span></div><div className="hidden h-9 w-px bg-white/30 sm:block"/><div className="hidden text-sm font-medium text-white/75 sm:block md:text-base">Painel do Apresentador</div></div><div className="flex items-center gap-2">{onOpenScreen&&<button type="button" onClick={onOpenScreen} className="hidden items-center gap-2 rounded-xl border border-white/12 bg-white/[.04] px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/[.08] md:flex"><Icon name="screen" className="h-4 w-4"/>Abrir telão</button>}{onFinish&&<button type="button" disabled={busy} onClick={onFinish} className="hidden items-center gap-2 rounded-xl border border-[#ff7f71]/25 bg-[#ff7f71]/7 px-3 py-2 text-xs font-semibold text-[#ff9a90] hover:bg-[#ff7f71]/12 disabled:opacity-50 md:flex"><Icon name="stop" className="h-4 w-4"/>Finalizar</button>}<img src="/brand/energisa.png" alt="Grupo Energisa" className="h-[clamp(28px,4.2vh,42px)] w-auto"/><div className="h-[clamp(26px,3.8vh,38px)] w-px bg-white/30"/><img src="/brand/enova.png" alt="Enova" className="h-[clamp(26px,3.9vh,39px)] w-auto"/></div><div className="absolute -bottom-px left-0 h-px w-[42%] bg-gradient-to-r from-[#a7d52c] via-[#6bd27f] to-[#00b6da]"/></header>
}

function Ring({ seconds, total, label }: { seconds:number; total:number; label?:string }) {
  const radius=106,c=2*Math.PI*radius,p=Math.max(0,Math.min(1,seconds/Math.max(1,total)))
  return <div className="relative mx-auto grid aspect-square w-full max-w-[min(280px,29vh)] place-items-center"><svg viewBox="0 0 260 260" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="130" cy="130" r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12"/><circle cx="130" cy="130" r={radius} fill="none" stroke="#a7d52c" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-p)} style={{filter:'drop-shadow(0 0 8px rgba(167,213,44,.45))'}}/><circle cx="130" cy="130" r="122" fill="none" stroke="rgba(0,182,218,.28)" strokeWidth="1" strokeDasharray="2 9"/></svg><div className="relative text-center">{label&&<div className="mb-2 text-xs font-semibold uppercase tracking-[.24em] text-[#00b6da]">{label}</div>}<div className="font-display text-[clamp(3.25rem,5.5vw,5.2rem)] font-extrabold leading-none tracking-[-.06em] text-[#a7d52c]">{String(Math.max(0,seconds)).padStart(2,'0')}</div></div></div>
}

function PairCard({ label, players, winnerId }: { label:string; players:any[]; winnerId?:string|null }) {
  return <div className="rounded-[18px] border border-white/9 bg-white/[.035] p-3.5"><div className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#00b6da]">{label}</div><div className="space-y-2">{players.map((p:any)=><div key={p.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${winnerId===p.id?'bg-[#a7d52c]/10':'bg-white/[.025]'}`}><div className="min-w-0"><div className="truncate text-sm font-semibold">{winnerId===p.id?'🏆 ':''}{p.display_name}</div><div className="text-[10px] text-white/42">{Number(p.correct_count??0)} acertos</div></div><div className="font-display text-lg font-extrabold text-[#bfe84a]">{Number(p.total_score??0).toLocaleString('pt-BR')}</div></div>)}</div></div>
}

function StageRail({ flow }: { flow:string }) {
  const stages=[['quiz','Quiz'],['semi','Semifinais'],['final','Final']]
  const active=flow.startsWith('semifinal')?'semi':flow.startsWith('final')||flow==='champion'?'final':'quiz'
  return <div className="grid grid-cols-3 gap-2">{stages.map(([key,label],index)=>{const order=['quiz','semi','final'];const done=order.indexOf(key)<order.indexOf(active)||flow==='champion';const isActive=key===active&&flow!=='champion';return <div key={key} className={`rounded-xl border px-3 py-2 text-center text-[11px] font-bold ${done?'border-[#a7d52c]/25 bg-[#a7d52c]/9 text-[#c3e94b]':isActive?'border-[#00b6da]/28 bg-[#00b6da]/8 text-[#62dcef]':'border-white/8 bg-white/[.025] text-white/35'}`}><div className="text-[9px] opacity-60">0{index+1}</div>{label}</div>})}</div>
}

export function PresenterLiveVisualPage({ sessionId, onOpenScreen, onFinish }: Props) {
  const notify=useToast()
  const { session, connected, ranking, answeredCount, answerableCount, answerPercent, remainingSeconds, currentRound, question }=useLiveDynamic(sessionId)
  const bracket=useLiveBracket(session)
  const [busy,setBusy]=useState(false)
  const flow=String(session?.paused?'paused':session?.flow_state??'lobby')
  const underlyingFlow=flow==='paused'?String(session?.paused_from_flow_state??''):flow
  const top=ranking.slice(0,10)
  const top4=ranking.slice(0,4)

  const call=async(fn:string,args:Record<string,unknown>)=>{setBusy(true);const {data,error}=await supabase.rpc(fn as never,args as never);setBusy(false);if(error){notify(error.message,'error');return null}return data}

  const action=async()=>{
    if(flow==='lobby') await call('presenter_start_auto_live_quiz',{p_session_id:sessionId})
    else if(flow==='paused') await call('presenter_resume_current_dynamic',{p_session_id:sessionId})
    else if(['prepare','question','reveal','ranking','semifinal_prepare','semifinal_question','semifinal_reveal','final_prepare','final_question','final_reveal'].includes(flow)) await call('presenter_pause_current_dynamic',{p_session_id:sessionId})
    else if(flow==='quiz_result') await call('presenter_start_current_semifinals',{p_session_id:sessionId})
    else if(flow==='semifinal_result') await call('presenter_start_current_final',{p_session_id:sessionId})
  }

  const finish=async()=>{if(!window.confirm('Finalizar esta dinâmica? O histórico será mantido e todos verão que a sessão foi encerrada.'))return;const result=await call('presenter_finish_current_dynamic',{p_session_id:sessionId});if(!result)return;notify('Dinâmica finalizada.');onFinish?.()}

  const meta=useMemo(()=>{
    if(flow==='lobby') return ['Aguardando participantes','Lobby',`${connected.length} participantes conectados`]
    if(flow==='paused') return ['Jogo pausado','Dinâmica pausada','Retome quando estiver pronto']
    if(flow==='prepare') return ['Prepare-se','Quiz Coletivo',`Pergunta ${session?.current_question_number??1} de ${session?.questions_total??0}`]
    if(flow==='question') return ['Jogo ao vivo','Quiz Coletivo',`Pergunta ${session?.current_question_number??1} de ${session?.questions_total??0}`]
    if(flow==='reveal') return ['Resposta revelada','Quiz Coletivo',`Pergunta ${session?.current_question_number??1} concluída`]
    if(flow==='ranking') return ['Ranking parcial','Quiz Coletivo','Próxima pergunta em instantes']
    if(flow==='quiz_result') return ['Etapa concluída','Top 4 definido','Pronto para iniciar as semifinais']
    if(flow==='semifinal_prepare') return ['Prepare-se','Semifinais','1º × 4º e 2º × 3º']
    if(flow==='semifinal_question') return ['Jogo ao vivo','Semifinais',`Rodada ${bracket.semifinal1.match?.current_round_number??1}`]
    if(flow==='semifinal_reveal') return ['Resposta revelada','Semifinais','Placares atualizados']
    if(flow==='semifinal_result') return ['Etapa concluída','Finalistas definidos','Pronto para a grande final']
    if(flow==='final_prepare') return ['Prepare-se','Grande Final','A disputa decisiva vai começar']
    if(flow==='final_question') return ['Jogo ao vivo','Grande Final',`Rodada ${bracket.final.match?.current_round_number??1}`]
    if(flow==='final_reveal') return ['Resposta revelada','Grande Final','Resultado atualizado']
    if(flow==='champion') return ['Dinâmica concluída','Temos um campeão!','Rota de Inovação']
    if(flow==='finished') return ['Dinâmica encerrada','Sessão finalizada','O histórico foi salvo']
    return ['Dinâmica ao vivo','Rota de Inovação','']
  },[flow,connected.length,session?.current_question_number,session?.questions_total,bracket.semifinal1.match?.current_round_number,bracket.final.match?.current_round_number])

  const activeRound=underlyingFlow.startsWith('semifinal')?bracket.semifinal1.round:underlyingFlow.startsWith('final')?bracket.final.round:currentRound
  const total=underlyingFlow.endsWith('prepare')?Number(session?.prepare_seconds??3):Number(activeRound?.timer_duration_seconds??session?.question_time_seconds??20)
  const canPause=['prepare','question','reveal','ranking','semifinal_prepare','semifinal_question','semifinal_reveal','final_prepare','final_question','final_reveal'].includes(flow)
  const buttonLabel=flow==='lobby'?'Iniciar Quiz':flow==='paused'?'Retomar':canPause?'Pausar':flow==='quiz_result'?'Iniciar Semifinais':flow==='semifinal_result'?'Iniciar Final':null
  const champion=bracket.final.players.find((p:any)=>p.id===bracket.final.match?.winner_player_id)
  const semiWinner1=bracket.semifinal1.players.find((p:any)=>p.id===bracket.semifinal1.match?.winner_player_id)
  const semiWinner2=bracket.semifinal2.players.find((p:any)=>p.id===bracket.semifinal2.match?.winner_player_id)
  const stageQuestion=underlyingFlow.startsWith('semifinal')||underlyingFlow.startsWith('final')?bracket.question:question

  if(!session)return <div className="grid h-[100dvh] place-items-center bg-[#020d23] text-white/70">Carregando dinâmica…</div>

  return <main className="relative h-[100dvh] overflow-hidden bg-[#020d23] text-white"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(23,77,145,.23),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]"/><div className="relative mx-auto grid h-full max-w-[1800px] grid-rows-[auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(10px,1.7vh,22px)]"><BrandHeader onOpenScreen={onOpenScreen} onFinish={()=>void finish()} busy={busy}/><div className="grid min-h-0 gap-[clamp(10px,1.2vw,20px)] pt-[clamp(12px,1.8vh,22px)] lg:grid-cols-[minmax(0,1.85fr)_minmax(340px,.95fr)]">

    <section className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#071936]/78 p-[clamp(14px,2.1vh,26px)] backdrop-blur-xl"><div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/14 bg-[#081d3e]/70 px-3.5 py-1.5 text-[11px] font-bold text-[#b8df3f]"><span className={`h-2 w-2 rounded-full ${flow==='paused'?'bg-[#ffb547]':'bg-[#a7d52c]'}`}/>{meta[0]}</div><div className="grid min-h-0 flex-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(210px,28vh)]"><div><h1 className="font-display text-[clamp(2.25rem,4.2vw,4.5rem)] font-extrabold leading-[.96] tracking-[-.055em]">{meta[1]}</h1><p className="mt-3 text-[clamp(1rem,1.35vw,1.35rem)] font-medium text-white/72">{meta[2]}</p><div className="mt-3 h-px w-60 max-w-[45%] bg-gradient-to-r from-[#a7d52c] to-[#00b6da]"/>

      {flow==='lobby'&&<div className="mt-7 grid max-w-xl grid-cols-2 gap-3"><div className="rounded-2xl border border-white/9 bg-white/[.035] p-4"><div className="text-xs text-white/55">Conectados</div><div className="mt-1 font-display text-4xl font-bold text-[#a7d52c]">{connected.length}</div></div><div className="rounded-2xl border border-white/9 bg-white/[.035] p-4"><div className="text-xs text-white/55">Status</div><div className="mt-2 text-sm font-semibold">Pronto para iniciar</div></div></div>}
      {['prepare','question','reveal','ranking'].includes(flow)&&<div className="mt-7 max-w-xl"><div className="mb-2 flex items-end gap-2"><Icon name="users" className="h-7 w-7 text-[#a7d52c]"/><span className="font-display text-4xl font-extrabold text-[#a7d52c]">{answeredCount}</span><span className="pb-1 text-white/70">de {answerableCount} responderam</span></div><div className="flex items-center gap-4"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-[#b2e32c] to-[#8ccf2a]" style={{width:`${answerPercent}%`}}/></div><span className="text-sm font-bold text-[#00b6da]">{answerPercent}%</span></div></div>}
      {flow==='quiz_result'&&<div className="mt-6 grid max-w-2xl grid-cols-2 gap-2">{top4.map((item:any,index:number)=><div key={item.participant_id} className="flex items-center gap-3 rounded-2xl border border-[#a7d52c]/18 bg-[#a7d52c]/7 px-4 py-3"><div className="font-display text-2xl font-extrabold text-[#bfe84a]">{index+1}º</div><div className="min-w-0"><div className="truncate font-semibold">{item.display_name}</div><div className="text-xs text-white/45">{Number(item.total_score??0).toLocaleString('pt-BR')} pts</div></div></div>)}</div>}
      {underlyingFlow.startsWith('semifinal')&&<div className="mt-6 grid max-w-3xl grid-cols-2 gap-3"><PairCard label="Semifinal 1" players={bracket.semifinal1.players} winnerId={bracket.semifinal1.match?.winner_player_id}/><PairCard label="Semifinal 2" players={bracket.semifinal2.players} winnerId={bracket.semifinal2.match?.winner_player_id}/></div>}
      {flow==='semifinal_result'&&<div className="mt-6 grid max-w-2xl grid-cols-2 gap-3">{[semiWinner1,semiWinner2].filter(Boolean).map((p:any)=><div key={p.id} className="rounded-2xl border border-[#a7d52c]/25 bg-[#a7d52c]/8 p-4"><div className="text-xs uppercase tracking-[.14em] text-[#bfe84a]">Finalista</div><div className="mt-2 font-display text-2xl font-extrabold">{p.display_name}</div></div>)}</div>}
      {(underlyingFlow.startsWith('final')||flow==='champion')&&<div className="mt-6 max-w-2xl"><PairCard label={flow==='champion'?'Resultado Final':'Grande Final'} players={bracket.final.players} winnerId={bracket.final.match?.winner_player_id}/></div>}
      {flow==='champion'&&champion&&<div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-[#a7d52c]/30 bg-[#a7d52c]/10 px-5 py-4"><Icon name="trophy" className="h-8 w-8 text-[#a7d52c]"/><div><div className="text-xs uppercase tracking-[.16em] text-[#bfe84a]">Campeão</div><div className="font-display text-3xl font-extrabold">{champion.display_name}</div></div></div>}
      {stageQuestion&&['question','semifinal_question','final_question'].includes(underlyingFlow)&&<div className="mt-5 max-w-3xl rounded-2xl border border-white/8 bg-white/[.025] p-4 text-sm font-semibold leading-relaxed text-white/78">{stageQuestion.statement}</div>}
    </div>

    {flow==='lobby'?<div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#00b6da]/20 bg-[#00b6da]/5"><div className="text-center"><Icon name="users" className="mx-auto mb-2 h-9 w-9 text-[#a7d52c]"/><div className="font-display text-6xl font-extrabold">{connected.length}</div><div className="mt-1 text-xs text-white/55">participantes</div></div></div>:flow==='quiz_result'||flow==='semifinal_result'||flow==='champion'?<div className="mx-auto grid aspect-square w-full max-w-[min(250px,27vh)] place-items-center rounded-full border border-[#a7d52c]/22 bg-[#a7d52c]/6"><Icon name="trophy" className="h-20 w-20 text-[#a7d52c]"/></div>:<Ring seconds={remainingSeconds} total={total} label={underlyingFlow.endsWith('prepare')?'Prepare-se':'Tempo'}/>}</div>

    {buttonLabel&&<button type="button" disabled={busy} onClick={()=>void action()} className="mt-3 flex h-[clamp(48px,6.3vh,66px)] shrink-0 items-center justify-center gap-3 rounded-2xl bg-[#a7d52c] font-display text-[clamp(1rem,1.3vw,1.3rem)] font-extrabold text-[#07152f] transition hover:brightness-105 disabled:opacity-50">{flow==='paused'||flow==='lobby'||flow==='quiz_result'||flow==='semifinal_result'?<Icon name="play"/>:<Icon name="pause"/>}{busy?'Processando…':buttonLabel}</button>}
    </section>

    <aside className="flex min-h-0 flex-col gap-3 overflow-hidden"><div className="rounded-[22px] border border-white/10 bg-[#071936]/82 p-4"><div className="mb-3 text-xs font-bold uppercase tracking-[.14em] text-white/48">Etapas</div><StageRail flow={underlyingFlow}/></div><div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-white/10 bg-[#071936]/82 p-4"><div className="mb-3 flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-[.14em] text-white/48">{underlyingFlow.startsWith('semifinal')?'Chaveamento':underlyingFlow.startsWith('final')||flow==='champion'?'Placar final':'Ranking ao vivo'}</div>{!underlyingFlow.startsWith('semifinal')&&!underlyingFlow.startsWith('final')&&flow!=='champion'&&<div className="text-[10px] text-white/35">Top 10</div>}</div><div className="h-full overflow-auto pr-1">
      {underlyingFlow.startsWith('semifinal')?<div className="space-y-3"><PairCard label="1º × 4º" players={bracket.semifinal1.players} winnerId={bracket.semifinal1.match?.winner_player_id}/><PairCard label="2º × 3º" players={bracket.semifinal2.players} winnerId={bracket.semifinal2.match?.winner_player_id}/></div>:underlyingFlow.startsWith('final')||flow==='champion'?<PairCard label="Final" players={bracket.final.players} winnerId={bracket.final.match?.winner_player_id}/>:<div className="space-y-1.5">{top.map((item:any,index:number)=><div key={item.participant_id} className={`grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-3 py-2 ${index<4?'bg-[#a7d52c]/7':'bg-white/[.025]'}`}><div className={`font-display font-extrabold ${index<4?'text-[#bfe84a]':'text-white/45'}`}>{index+1}</div><div className="truncate text-sm font-semibold text-white/82">{item.display_name}</div><div className="text-xs font-bold text-white/58">{Number(item.total_score??0).toLocaleString('pt-BR')}</div></div>)}</div>}
    </div></div><div className="rounded-[22px] border border-white/10 bg-[#071936]/82 p-4"><div className="flex items-center justify-between text-xs"><span className="text-white/45">Participantes conectados</span><span className="font-display text-lg font-extrabold text-[#a7d52c]">{connected.length}</span></div></div></aside>

  </div></div></main>
}
