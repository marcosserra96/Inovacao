import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useParticipantLiveState } from '@/hooks/useParticipantLiveState'
import { loadLiveQuizParticipant } from '@/lib/liveQuizStorage'
import { supabase } from '@/lib/supabase'

function BrandHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3.5">
      <div className="font-display text-[19px] font-extrabold tracking-[-.045em]"><span className="text-[#a7d52c]">Rota de </span><span className="text-white">Inovação</span></div>
      <div className="flex items-center gap-2"><img src="/brand/energisa.png" alt="Grupo Energisa" className="h-5 w-auto"/><div className="h-5 w-px bg-white/25"/><img src="/brand/enova.png" alt="Enova" className="h-[18px] w-auto"/></div>
    </header>
  )
}

function Dots(){return <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] w-full opacity-40" viewBox="0 0 420 180" preserveAspectRatio="none"><defs><pattern id="participant-live-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#00b6da"/></pattern></defs><path d="M-20 135 C72 72 144 184 230 122 C302 70 344 78 450 104 L450 190 L-20 190 Z" fill="url(#participant-live-dots)"/></svg>}

function Badge({ children, cyan=false }: { children: React.ReactNode; cyan?: boolean }) {
  return <div className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] ${cyan?'border-[#00b6da]/24 bg-[#00b6da]/8 text-[#5ddcf2]':'border-[#a7d52c]/24 bg-[#a7d52c]/8 text-[#c1e944]'}`}>{children}</div>
}

function Timer({ seconds, total }: { seconds:number; total:number }) {
  const safeSeconds=Number.isFinite(seconds)?Math.max(0,seconds):0
  const safeTotal=Number.isFinite(total)?Math.max(1,total):1
  const r=24,c=2*Math.PI*r,p=Math.max(0,Math.min(1,safeSeconds/safeTotal))
  return <div className="relative grid h-[62px] w-[62px] shrink-0 place-items-center"><svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/><circle cx="30" cy="30" r={r} fill="none" stroke="#a7d52c" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-p)}/></svg><span className="font-display text-[23px] font-extrabold text-[#a7d52c]">{String(safeSeconds).padStart(2,'0')}</span></div>
}

function CenterMessage({ badge, title, text }: { badge:string; title:string; text:string }) {
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><Badge>{badge}</Badge><h1 className="mt-5 font-display text-[38px] font-extrabold leading-[.98] tracking-[-.05em] text-white">{title}</h1><p className="mt-4 max-w-[290px] text-sm leading-[1.65] text-white/58">{text}</p></div>
}

function Prepare({ label, seconds }: { label:string; seconds:number }) {
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><Badge cyan>{label}</Badge><h1 className="mt-6 font-display text-[30px] font-extrabold text-white">Prepare-se</h1><div className="mt-7 font-display text-[72px] font-extrabold leading-none text-[#a7d52c]">{Math.max(1,seconds)}</div><p className="mt-7 text-sm text-white/48">A próxima pergunta aparece em instantes</p></div>
}

type QuestionViewProps = {
  eyebrow:string
  meta:string
  statement:string
  options:any[]
  selected:string|null
  answered:boolean
  submitting:boolean
  seconds:number
  total:number
  onAnswer:(optionId:string)=>void
}

function QuestionView({eyebrow,meta,statement,options,selected,answered,submitting,seconds,total,onAnswer}:QuestionViewProps){
  return <div className="flex min-h-0 flex-1 flex-col"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.17em] text-[#00b6da]">{eyebrow}</div><div className="mt-1.5 text-xs font-semibold text-white/48">{meta}</div></div><Timer seconds={seconds} total={total}/></div><h1 className="mt-4 font-display text-[21px] font-extrabold leading-[1.16] tracking-[-.035em] text-white">{statement}</h1><div className="mt-5 grid min-h-0 flex-1 gap-2.5" style={{gridTemplateRows:`repeat(${Math.max(1,options.length||4)},minmax(0,1fr))`}}>{options.map((option,index)=>{const optionId=String(option.optionId??index);const isSelected=selected===optionId;return <button key={optionId} disabled={answered||submitting} onClick={()=>onAnswer(optionId)} className={`flex min-h-0 items-center gap-3 rounded-2xl border px-3 text-left ${isSelected?'border-[#a7d52c]/55 bg-[#a7d52c]/12':'border-white/10 bg-white/[.04]'}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-base font-extrabold ${isSelected?'border-[#a7d52c]/40 bg-[#a7d52c]/14 text-[#c1e944]':'border-[#00b6da]/25 bg-[#00b6da]/8 text-[#5ddcf2]'}`}>{String.fromCharCode(65+index)}</span><span className="text-[13px] font-semibold leading-snug text-white/86">{String(option.text??'')}</span></button>})}</div>{answered&&<div className="mt-3.5 rounded-xl border border-[#a7d52c]/20 bg-[#a7d52c]/8 px-3 py-2.5 text-center text-xs font-bold text-[#c1e944]">Resposta registrada</div>}</div>
}

function Reveal({ correct, points, nextText }: {correct:boolean;points:number;nextText:string}){
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><div className={`grid h-24 w-24 place-items-center rounded-full border ${correct?'border-[#a7d52c]/28 bg-[#a7d52c]/9 text-[#a7d52c]':'border-[#ff7f71]/25 bg-[#ff7f71]/8 text-[#ff9186]'}`}><span className="text-4xl">{correct?'✓':'×'}</span></div><h1 className="mt-6 font-display text-[38px] font-extrabold leading-none tracking-[-.05em] text-white">{correct?'Mandou bem!':'Quase!'}</h1><div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="text-[10px] uppercase tracking-[.15em] text-white/38">Pontos desta pergunta</div><div className="mt-2 font-display text-[32px] font-extrabold text-[#a7d52c]">+{Number(points??0)}</div></div><div className="mt-6 text-xs text-white/42">{nextText}</div></div>
}

export function ParticipantLiveVisualPage(){
  const { sessionId, participantId }=useParams<{sessionId:string;participantId:string}>()
  const location=useLocation()
  const stored=sessionId&&participantId?loadLiveQuizParticipant(sessionId,participantId):null
  const navigationToken=(location.state as {joinToken?:string}|null)?.joinToken ?? null
  const joinToken=stored&&stored.participantId===participantId?stored.joinToken:navigationToken
  const { session, participant:me, round:currentRound, question, answered, myResult, duel, remainingSeconds, error }=useParticipantLiveState(sessionId,participantId,joinToken)
  const [selected,setSelected]=useState<string|null>(null)
  const [submitting,setSubmitting]=useState(false)
  const flow=session?.paused?'paused':session?.flow_state
  const collectiveOptions=Array.isArray(question?.options)?question.options:[]
  const duelOptions=Array.isArray(duel.question?.options)?duel.question.options:[]
  const currentIdentity=`${currentRound?.id??''}:${duel.round?.id??''}`

  useEffect(()=>{setSelected(null);setSubmitting(false)},[currentIdentity])

  const statement=(value?:string|null)=>session?.hide_statement_on_phone?'Acompanhe o enunciado no telão.':String(value??'Preparando pergunta…')

  async function answerCollective(optionId:string){
    if(!currentRound||answered||submitting||!joinToken||!participantId) return
    setSelected(optionId);setSubmitting(true)
    const { error:submitError }=await supabase.rpc('submit_live_quiz_answer',{p_round_id:currentRound.id,p_participant_id:participantId,p_join_token:joinToken,p_option_id:optionId})
    setSubmitting(false)
    if(submitError) setSelected(null)
  }

  async function answerDuel(optionId:string){
    if(!duel.round||duel.answered||submitting||!duel.promotion?.duelPlayerId||!duel.promotion?.duelJoinToken) return
    setSelected(optionId);setSubmitting(true)
    const { error:submitError }=await supabase.rpc('submit_duel_answer',{
      p_round_id:duel.round.id,
      p_player_id:duel.promotion.duelPlayerId,
      p_join_token:duel.promotion.duelJoinToken,
      p_option_id:optionId,
    })
    setSubmitting(false)
    if(submitError) setSelected(null)
  }

  const isFinalist=Boolean(me?.is_finalist)
  const isSemiWinner=Boolean(duel.match?.winner_player_id&&duel.player?.id===duel.match.winner_player_id)
  const isCurrentFinalPlayer=Boolean(session?.promoted_duel_match_id&&duel.promotion?.duelMatchId===session.promoted_duel_match_id)
  const isChampion=Boolean(isCurrentFinalPlayer&&duel.match?.winner_player_id===duel.player?.id)
  const duelTimerTotal=Number(duel.round?.timer_duration_seconds??session?.question_time_seconds??20)
  const collectiveTimerTotal=Number(currentRound?.timer_duration_seconds??session?.question_time_seconds??20)

  let content:React.ReactNode
  if(error&&!session) content=<CenterMessage badge="Reconectando" title="Só um instante…" text="Estamos recuperando sua conexão com a dinâmica."/>
  else if(!session||!me) content=<CenterMessage badge="Conectando" title="Só um instante…" text="Estamos preparando sua participação."/>
  else if(!joinToken) content=<CenterMessage badge="Atenção" title="Entrada não encontrada" text="Abra novamente o QR Code neste mesmo celular para entrar na dinâmica."/>
  else if(flow==='finished'||session.status==='finished') content=<CenterMessage badge="Encerrado" title="Dinâmica finalizada" text="Obrigado por participar da Rota de Inovação."/>
  else if(flow==='lobby') content=<CenterMessage badge="Conectado" title="Você está dentro!" text={`${String(me.display_name??'Participante')}, acompanhe o telão. O quiz começa quando o apresentador liberar.`}/>
  else if(flow==='paused') content=<CenterMessage badge="Jogo pausado" title="Aguarde um instante" text="A dinâmica continuará exatamente do ponto em que parou."/>
  else if(flow==='prepare') content=<Prepare label="Próxima pergunta" seconds={remainingSeconds}/>
  else if(flow==='question') content=<QuestionView eyebrow="Quiz coletivo" meta={`Pergunta ${Number(session.current_question_number??0)} de ${Number(session.questions_total??0)}`} statement={statement(question?.statement)} options={collectiveOptions} selected={selected} answered={answered} submitting={submitting} seconds={remainingSeconds} total={collectiveTimerTotal} onAnswer={(id)=>void answerCollective(id)}/>
  else if(flow==='reveal') content=<Reveal correct={Boolean(myResult?.isCorrect)} points={Number(myResult?.pointsAwarded??0)} nextText="Próxima pergunta em instantes"/>
  else if(flow==='ranking') content=<CenterMessage badge="Ranking parcial" title="Acompanhe o telão" text="O ranking está sendo exibido para a sala. Sua posição individual continua reservada."/>
  else if(flow==='quiz_result') content=isFinalist?<CenterMessage badge="Classificado" title="Você está na semifinal!" text="Fique atento ao telão. A próxima etapa começa quando o apresentador liberar."/>:<CenterMessage badge="Quiz concluído" title="Valeu pela participação!" text="Continue acompanhando as semifinais e a final pelo telão."/>
  else if(flow==='semifinal_prepare') content=isFinalist?<Prepare label="Semifinal" seconds={remainingSeconds}/>:<CenterMessage badge="Semifinais" title="Agora é torcida!" text="Os quatro classificados estão em disputa. Acompanhe tudo pelo telão."/>
  else if(flow==='semifinal_question') content=isFinalist?<QuestionView eyebrow="Semifinal" meta={`${String(duel.player?.display_name??'Você')} × ${String(duel.opponent?.display_name??'adversário')}`} statement={statement(duel.question?.statement)} options={duelOptions} selected={selected} answered={duel.answered} submitting={submitting} seconds={remainingSeconds} total={duelTimerTotal} onAnswer={(id)=>void answerDuel(id)}/>:<CenterMessage badge="Semifinais" title="Acompanhe o telão" text="As duas disputas estão acontecendo ao mesmo tempo."/>
  else if(flow==='semifinal_reveal') content=isFinalist?<Reveal correct={Boolean(duel.myResult?.isCorrect)} points={Number(duel.myResult?.pointsAwarded??0)} nextText="A semifinal continua em instantes"/>:<CenterMessage badge="Semifinais" title="Acompanhe o telão" text="Resultado da rodada sendo revelado para a sala."/>
  else if(flow==='semifinal_result') content=isFinalist?(isSemiWinner?<CenterMessage badge="Classificado" title="Você está na Final!" text="Parabéns! Aguarde o apresentador iniciar a disputa decisiva."/>:<CenterMessage badge="Semifinal concluída" title="Foi por pouco!" text="Sua participação na disputa terminou aqui. Acompanhe a grande final pelo telão."/>):<CenterMessage badge="Semifinais concluídas" title="Vem aí a Final" text="Acompanhe os dois finalistas pelo telão."/>
  else if(flow==='final_prepare') content=isCurrentFinalPlayer?<Prepare label="Grande Final" seconds={remainingSeconds}/>:<CenterMessage badge="Grande Final" title="Agora é torcida!" text="Os dois finalistas estão prontos. Acompanhe a disputa pelo telão."/>
  else if(flow==='final_question') content=isCurrentFinalPlayer?<QuestionView eyebrow="Grande Final" meta={`${String(duel.player?.display_name??'Você')} × ${String(duel.opponent?.display_name??'adversário')}`} statement={statement(duel.question?.statement)} options={duelOptions} selected={selected} answered={duel.answered} submitting={submitting} seconds={remainingSeconds} total={duelTimerTotal} onAnswer={(id)=>void answerDuel(id)}/>:<CenterMessage badge="Grande Final" title="Acompanhe o telão" text="A disputa decisiva está acontecendo agora."/>
  else if(flow==='final_reveal') content=isCurrentFinalPlayer?<Reveal correct={Boolean(duel.myResult?.isCorrect)} points={Number(duel.myResult?.pointsAwarded??0)} nextText="Resultado final em instantes"/>:<CenterMessage badge="Grande Final" title="Acompanhe o telão" text="A resposta da final está sendo revelada."/>
  else if(flow==='champion') content=isCurrentFinalPlayer?(isChampion?<CenterMessage badge="Campeão" title="Você venceu! 🏆" text="Parabéns! Você é o campeão da Rota de Inovação."/>:<CenterMessage badge="Finalista" title="Que disputa!" text="Você chegou à grande final. Parabéns pela participação!"/>):<CenterMessage badge="Temos um campeão" title="Fim da disputa!" text="Confira o resultado no telão."/>
  else content=<CenterMessage badge="Rota de Inovação" title="Acompanhe o telão" text="A dinâmica está seguindo para a próxima etapa."/>

  return <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#020d23] text-white"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(23,77,145,.24),transparent_32%),radial-gradient(circle_at_88%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]"/><Dots/><div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col px-5 py-4"><BrandHeader/>{content}</div></main>
}
