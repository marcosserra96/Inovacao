import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveDynamic } from '@/hooks/useLiveDynamic'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { loadLiveQuizParticipant } from '@/lib/liveQuizStorage'
import { supabase } from '@/lib/supabase'

type Participant = any
type AnswerFlag = any

type RoundResult = {
  roundId: string
  revealedAt: string
  answers: Array<{
    participantId: string
    optionId: string | null
    isCorrect: boolean
    isLate: boolean
    pointsAwarded: number
  }>
}

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
  const r=24,c=2*Math.PI*r,p=Math.max(0,Math.min(1,seconds/Math.max(1,total)))
  return <div className="relative grid h-[62px] w-[62px] shrink-0 place-items-center"><svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/><circle cx="30" cy="30" r={r} fill="none" stroke="#a7d52c" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-p)}/></svg><span className="font-display text-[23px] font-extrabold text-[#a7d52c]">{String(seconds).padStart(2,'0')}</span></div>
}

function CenterMessage({ badge, title, text }: { badge:string; title:string; text:string }) {
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><Badge>{badge}</Badge><h1 className="mt-5 font-display text-[38px] font-extrabold leading-[.98] tracking-[-.05em] text-white">{title}</h1><p className="mt-4 max-w-[290px] text-sm leading-[1.65] text-white/58">{text}</p></div>
}

export function ParticipantLiveVisualPage(){
  const { sessionId, participantId }=useParams<{sessionId:string;participantId:string}>()
  const { session, question, currentRound, remainingSeconds }=useLiveDynamic(sessionId)
  const { row: me }=useRealtimeRow<Participant>('live_quiz_participants', participantId)
  const { rows: flags }=useRealtimeList<AnswerFlag>('live_quiz_answer_flags','round_id',currentRound?.id)
  const stored=sessionId&&participantId?loadLiveQuizParticipant(sessionId,participantId):null
  const joinToken=stored?.participantId===participantId?stored.joinToken:null
  const [selected,setSelected]=useState<string|null>(null)
  const [submitting,setSubmitting]=useState(false)
  const [result,setResult]=useState<RoundResult|null>(null)

  useEffect(()=>{setSelected(null);setResult(null)},[currentRound?.id])
  useEffect(()=>{
    if(!currentRound?.revealed_at) return
    void supabase.rpc('get_live_quiz_round_result',{p_round_id:currentRound.id}).then(({data})=>setResult(data as unknown as RoundResult))
  },[currentRound?.id,currentRound?.revealed_at])

  const answered=flags.some((flag:any)=>flag.participant_id===participantId&&flag.answered)
  const myResult=useMemo(()=>result?.answers.find(answer=>answer.participantId===participantId)??null,[result,participantId])
  const flow=session?.paused?'paused':session?.flow_state
  const timerTotal=currentRound?.timer_duration_seconds ?? session?.prepare_seconds ?? 3

  async function answer(optionId:string){
    if(!currentRound||answered||submitting||!joinToken||!participantId) return
    setSelected(optionId);setSubmitting(true)
    const { error }=await supabase.rpc('submit_live_quiz_answer',{p_round_id:currentRound.id,p_participant_id:participantId,p_join_token:joinToken,p_option_id:optionId})
    setSubmitting(false)
    if(error) setSelected(null)
  }

  let content:React.ReactNode
  if(!session||!me) content=<CenterMessage badge="Conectando" title="Só um instante…" text="Estamos preparando sua participação."/>
  else if(!joinToken) content=<CenterMessage badge="Atenção" title="Entrada não encontrada" text="Abra novamente o QR Code neste mesmo celular para entrar na dinâmica."/>
  else if(flow==='lobby') content=<CenterMessage badge="Conectado" title="Você está dentro!" text={`${me.display_name}, acompanhe o telão. O quiz começa quando o apresentador liberar.`}/>
  else if(flow==='paused') content=<CenterMessage badge="Jogo pausado" title="Aguarde um instante" text="A dinâmica continuará exatamente do ponto em que parou."/>
  else if(flow==='prepare') content=<div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><Badge cyan>Próxima pergunta</Badge><h1 className="mt-6 font-display text-[30px] font-extrabold text-white">Prepare-se</h1><div className="mt-7"><Timer seconds={remainingSeconds} total={session.prepare_seconds??3}/></div><p className="mt-7 text-sm text-white/48">A pergunta aparece em instantes</p></div>
  else if(flow==='question') content=<div className="flex min-h-0 flex-1 flex-col"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.17em] text-[#00b6da]">Quiz coletivo</div><div className="mt-1.5 text-xs font-semibold text-white/48">Pergunta {session.current_question_number} de {session.questions_total}</div></div><Timer seconds={remainingSeconds} total={timerTotal}/></div><h1 className="mt-4 font-display text-[21px] font-extrabold leading-[1.16] tracking-[-.035em] text-white">{question?.statement??'Preparando pergunta…'}</h1><div className="mt-5 grid min-h-0 flex-1 gap-2.5" style={{gridTemplateRows:`repeat(${Math.max(1,question?.options.length??4)},minmax(0,1fr))`}}>{question?.options.map((option,index)=>{const isSelected=selected===option.optionId||answered&&selected===option.optionId;return <button key={option.optionId} disabled={answered||submitting} onClick={()=>void answer(option.optionId)} className={`flex min-h-0 items-center gap-3 rounded-2xl border px-3 text-left ${isSelected?'border-[#a7d52c]/55 bg-[#a7d52c]/12':'border-white/10 bg-white/[.04]'}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-base font-extrabold ${isSelected?'border-[#a7d52c]/40 bg-[#a7d52c]/14 text-[#c1e944]':'border-[#00b6da]/25 bg-[#00b6da]/8 text-[#5ddcf2]'}`}>{String.fromCharCode(65+index)}</span><span className="text-[13px] font-semibold leading-snug text-white/86">{option.text}</span></button>})}</div>{answered&&<div className="mt-3.5 rounded-xl border border-[#a7d52c]/20 bg-[#a7d52c]/8 px-3 py-2.5 text-center text-xs font-bold text-[#c1e944]">Resposta registrada</div>}</div>
  else if(flow==='reveal') content=<div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><div className={`grid h-24 w-24 place-items-center rounded-full border ${myResult?.isCorrect?'border-[#a7d52c]/28 bg-[#a7d52c]/9 text-[#a7d52c]':'border-[#ff7f71]/25 bg-[#ff7f71]/8 text-[#ff9186]'}`}><span className="text-4xl">{myResult?.isCorrect?'✓':'×'}</span></div><h1 className="mt-6 font-display text-[38px] font-extrabold leading-none tracking-[-.05em] text-white">{myResult?.isCorrect?'Mandou bem!':'Quase!'}</h1><div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="text-[10px] uppercase tracking-[.15em] text-white/38">Pontos desta pergunta</div><div className="mt-2 font-display text-[32px] font-extrabold text-[#a7d52c]">+{myResult?.pointsAwarded??0}</div></div><div className="mt-6 text-xs text-white/42">Próxima pergunta em instantes</div></div>
  else if(flow==='quiz_result') content=me.is_finalist?<CenterMessage badge="Classificado" title="Você está na semifinal!" text="Fique atento ao telão. A próxima etapa começa quando o apresentador liberar."/>:<CenterMessage badge="Quiz concluído" title="Valeu pela participação!" text="Continue acompanhando as semifinais e a final pelo telão."/>
  else content=<CenterMessage badge="Rota de Inovação" title="Acompanhe o telão" text="A dinâmica está seguindo para a próxima etapa."/>

  return <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#020d23] text-white"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(23,77,145,.24),transparent_32%),radial-gradient(circle_at_88%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]"/><Dots/><div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col px-5 py-4"><BrandHeader/>{content}</div></main>
}
