import { QuizBrand } from '@/components/quiz/QuizBrand'
import { useQuizVisualTheme, themeStyle, type QuizVisualTheme } from '@/lib/quizVisualTheme'
import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useParticipantLiveState } from '@/hooks/useParticipantLiveState'
import { loadLiveQuizParticipant } from '@/lib/liveQuizStorage'
import { supabase } from '@/lib/supabase'

function BrandHeader({theme}:{theme:QuizVisualTheme}) { return <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 pb-3.5"><QuizBrand theme={theme} small /></header> }

function Dots(){return <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] w-full opacity-40" viewBox="0 0 420 180" preserveAspectRatio="none"><defs><pattern id="participant-live-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="var(--quiz-secondary)"/></pattern></defs><path d="M-20 135 C72 72 144 184 230 122 C302 70 344 78 450 104 L450 190 L-20 190 Z" fill="url(#participant-live-dots)"/></svg>}

function Badge({ children, cyan=false }: { children: React.ReactNode; cyan?: boolean }) {
  return <div className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] ${cyan?'border-[var(--quiz-secondary)]/24 bg-[var(--quiz-secondary)]/8 text-[#5ddcf2]':'border-[var(--quiz-primary)]/24 bg-[var(--quiz-primary)]/8 text-[#c1e944]'}`}>{children}</div>
}

function Timer({ seconds, total }: { seconds:number; total:number }) {
  const safeSeconds=Number.isFinite(seconds)?Math.max(0,seconds):0
  const safeTotal=Number.isFinite(total)?Math.max(1,total):1
  const r=24,c=2*Math.PI*r,p=Math.max(0,Math.min(1,safeSeconds/safeTotal))
  return <div className="relative grid h-[62px] w-[62px] shrink-0 place-items-center"><svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full -rotate-90"><circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/><circle cx="30" cy="30" r={r} fill="none" stroke="var(--quiz-primary)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-p)}/></svg><span className="font-display text-[23px] font-extrabold text-[var(--quiz-primary)]">{String(safeSeconds).padStart(2,'0')}</span></div>
}

function CenterMessage({ badge, title, text }: { badge:string; title:string; text:string }) {
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><Badge>{badge}</Badge><h1 className="mt-5 font-display text-[38px] font-extrabold leading-[.98] tracking-[-.05em] text-white">{title}</h1><p className="mt-4 max-w-[290px] text-sm leading-[1.65] text-white/58">{text}</p></div>
}

function Prepare({ label, seconds }: { label:string; seconds:number }) {
  return <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center"><Badge cyan>{label}</Badge><h1 className="mt-6 font-display text-[30px] font-extrabold text-white">Prepare-se</h1><div className="mt-7 font-display text-[72px] font-extrabold leading-none text-[var(--quiz-primary)]">{Math.max(1,seconds)}</div><p className="mt-7 text-sm text-white/48">A próxima pergunta aparece em instantes</p></div>
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
  return <div className="flex min-h-0 flex-1 flex-col"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--quiz-secondary)]">{eyebrow}</div><div className="mt-1.5 text-xs font-semibold text-white/48">{meta}</div></div><Timer seconds={seconds} total={total}/></div><h1 className="mt-4 font-display text-[21px] font-extrabold leading-[1.16] tracking-[-.035em] text-white">{statement}</h1><div className="mt-5 grid min-h-0 flex-1 gap-2.5" style={{gridTemplateRows:`repeat(${Math.max(1,options.length||4)},minmax(0,1fr))`}}>{options.map((option,index)=>{const optionId=String(option.optionId??index);const isSelected=selected===optionId;return <button key={optionId} disabled={answered||submitting} onClick={()=>onAnswer(optionId)} className={`live-mobile-choice flex min-h-0 items-center gap-3 rounded-2xl border px-3 text-left ${isSelected?'border-[var(--quiz-primary)]/55 bg-[var(--quiz-primary)]/12':'border-white/10 bg-white/[.04]'}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-base font-extrabold ${isSelected?'border-[var(--quiz-primary)]/40 bg-[var(--quiz-primary)]/14 text-[#c1e944]':'border-[var(--quiz-secondary)]/25 bg-[var(--quiz-secondary)]/8 text-[#5ddcf2]'}`}>{String.fromCharCode(65+index)}</span><span className="text-[13px] font-semibold leading-snug text-white/86">{String(option.text??'')}</span></button>})}</div>{answered&&<div className="mt-3.5 rounded-xl border border-[var(--quiz-primary)]/20 bg-[var(--quiz-primary)]/8 px-3 py-2.5 text-center text-xs font-bold text-[#c1e944]">Resposta registrada</div>}</div>
}

function Reveal({ correct, points, nextText }: {correct:boolean;points:number;nextText:string}){
  return <div className="live-mobile-scene flex min-h-0 flex-1 flex-col items-center justify-center text-center"><div className={`grid h-24 w-24 place-items-center rounded-full border ${correct?'border-[var(--quiz-primary)]/28 bg-[var(--quiz-primary)]/9 text-[var(--quiz-primary)]':'border-[#ff7f71]/25 bg-[#ff7f71]/8 text-[#ff9186]'}`}><span className="text-4xl">{correct?'✓':'×'}</span></div><h1 className="mt-6 font-display text-[38px] font-extrabold leading-none tracking-[-.05em] text-white">{correct?'Mandou bem!':'Quase!'}</h1><div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="text-[10px] uppercase tracking-[.15em] text-white/38">Pontos desta pergunta</div><div className="mt-2 font-display text-[32px] font-extrabold text-[var(--quiz-primary)]">+{Number(points??0)}</div></div><div className="mt-6 text-xs text-white/42">{nextText}</div></div>
}

export function ParticipantLiveVisualPage(){
  const { sessionId, participantId }=useParams<{sessionId:string;participantId:string}>()
  const location=useLocation()
  const stored=sessionId&&participantId?loadLiveQuizParticipant(sessionId,participantId):null
  const navigationToken=(location.state as {joinToken?:string}|null)?.joinToken ?? null
  const joinToken=stored&&stored.participantId===participantId?stored.joinToken:navigationToken
  const theme = useQuizVisualTheme(sessionId)
  const { session, participant:me, round:currentRound, question, answered, myResult, resultLoaded, duel, remainingSeconds, error }=useParticipantLiveState(sessionId,participantId,joinToken)
  const [selected,setSelected]=useState<string|null>(null)
  const [submitting,setSubmitting]=useState(false)
  const [submissionWarning,setSubmissionWarning]=useState('')
  const [online,setOnline]=useState(typeof navigator==='undefined'?true:navigator.onLine)
  const flow=session?.paused?'paused':session?.flow_state
  const collectiveOptions=Array.isArray(question?.options)?question.options:[]
  const duelOptions=Array.isArray(duel.question?.options)?duel.question.options:[]
  const currentIdentity=`${currentRound?.id??''}:${duel.round?.id??''}`

  useEffect(()=>{setSelected(null);setSubmitting(false);setSubmissionWarning('')},[currentIdentity])
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine)
    window.addEventListener('online',update)
    window.addEventListener('offline',update)
    return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}
  },[])

  const statement=(value?:string|null)=>session?.hide_statement_on_phone?'Acompanhe o enunciado no telão.':String(value??'Preparando pergunta…')

  async function answerCollective(optionId:string){
    if(!currentRound||answered||submitting||!joinToken||!participantId) return
    setSelected(optionId);setSubmitting(true)
    const { error:submitError }=await supabase.rpc('submit_live_quiz_answer',{p_round_id:currentRound.id,p_participant_id:participantId,p_join_token:joinToken,p_option_id:optionId})
    if(submitError){
      const {data:confirmed}=await supabase.from('live_quiz_answer_flags').select('answered')
        .eq('round_id',currentRound.id).eq('participant_id',participantId).maybeSingle()
      if((confirmed as {answered?:boolean}|null)?.answered){
        setSubmissionWarning('Resposta recebida pelo servidor.')
      }else{
        setSelected(null)
        setSubmissionWarning('Não foi possível confirmar o envio. Confira sua conexão e tente novamente enquanto a pergunta estiver aberta.')
      }
    }else setSubmissionWarning('')
    setSubmitting(false)
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
    if(submitError){
      const {data:confirmed}=await supabase.from('duel_answer_flags').select('answered')
        .eq('round_id',duel.round.id).eq('player_id',duel.promotion.duelPlayerId).maybeSingle()
      if((confirmed as {answered?:boolean}|null)?.answered){
        setSubmissionWarning('Resposta recebida pelo servidor.')
      }else{
        setSelected(null)
        setSubmissionWarning('Envio não confirmado. Verifique sua conexão e tente novamente se ainda houver tempo.')
      }
    }else setSubmissionWarning('')
    setSubmitting(false)
  }

  const isFinalist=Boolean(me?.is_finalist)
  const isSemiWinner=Boolean(duel.match?.winner_player_id&&duel.player?.id===duel.match.winner_player_id)
  const isCurrentFinalPlayer=Boolean(session?.promoted_duel_match_id&&duel.promotion?.duelMatchId===session.promoted_duel_match_id)
  const isChampion=Boolean(isCurrentFinalPlayer&&duel.match?.winner_player_id===duel.player?.id)||Boolean(flow==='champion'&&session?.direct_champion_participant_id===participantId)
  const duelTimerTotal=Number(duel.round?.timer_duration_seconds??session?.question_time_seconds??20)
  const collectiveTimerTotal=Number(currentRound?.timer_duration_seconds??session?.question_time_seconds??20)

  let content:React.ReactNode
  if(error&&!session) content=<CenterMessage badge="Reconectando" title="Só um instante…" text="Estamos recuperando sua conexão com a dinâmica."/>
  else if(!session||!me) content=<CenterMessage badge="Conectando" title="Só um instante…" text="Estamos preparando sua participação."/>
  else if(!joinToken) content=<CenterMessage badge="Atenção" title="Entrada não encontrada" text="Abra novamente o QR Code neste mesmo celular para entrar na dinâmica."/>
  else if(flow==='finished'||session.status==='finished') content=<CenterMessage badge="Encerrado" title="Dinâmica finalizada" text="Obrigado por participar desta dinâmica."/>
  else if(flow==='lobby') content=<CenterMessage badge="Conectado" title="Você está dentro!" text={`${String(me.display_name??'Participante')}, acompanhe o telão. O quiz começa quando o apresentador liberar.`}/>
  else if(flow==='paused') content=<CenterMessage badge="Jogo pausado" title="Aguarde um instante" text="A dinâmica continuará exatamente do ponto em que parou."/>
  else if(flow==='prepare') content=<Prepare label="Próxima pergunta" seconds={remainingSeconds}/>
  else if(flow==='question') content=<QuestionView eyebrow="Quiz coletivo" meta={`Pergunta ${Number(session.current_question_number??0)} de ${Number(session.questions_total??0)}`} statement={statement(question?.statement)} options={collectiveOptions} selected={selected} answered={answered} submitting={submitting} seconds={remainingSeconds} total={collectiveTimerTotal} onAnswer={(id)=>void answerCollective(id)}/>
  else if(flow==='reveal') content=resultLoaded?<Reveal correct={Boolean(myResult?.isCorrect)} points={Number(myResult?.pointsAwarded??0)} nextText="Próxima pergunta em instantes"/>:<CenterMessage badge="Verificando" title="Conferindo resposta…" text="Aguarde a confirmação do resultado."/>
  else if(flow==='ranking') content=<CenterMessage badge="Ranking parcial" title="Acompanhe o telão" text="O ranking está sendo exibido para a sala. Sua posição individual continua reservada."/>
  else if(flow==='quiz_result') content=!session.enable_final?<CenterMessage badge="Quiz concluído" title="Chegou a hora do resultado" text="O vencedor será revelado no telão."/>:!session.enable_semifinals?<CenterMessage badge="Quiz concluído" title="Vem aí a Final" text="Os dois primeiros colocados vão disputar a final. Acompanhe o telão."/>:isFinalist?<CenterMessage badge="Classificado" title="Você está na semifinal!" text="Fique atento ao telão. A próxima etapa começa quando o apresentador liberar."/>:<CenterMessage badge="Quiz concluído" title="Valeu pela participação!" text="Continue acompanhando as semifinais e a final pelo telão."/>
  else if(flow==='semifinal_prepare') content=isFinalist?<Prepare label="Semifinal" seconds={remainingSeconds}/>:<CenterMessage badge="Semifinais" title="Agora é torcida!" text="Os quatro classificados estão em disputa. Acompanhe tudo pelo telão."/>
  else if(flow==='semifinal_question') content=isFinalist?<QuestionView eyebrow="Semifinal" meta={`${String(duel.player?.display_name??'Você')} × ${String(duel.opponent?.display_name??'adversário')}`} statement={statement(duel.question?.statement)} options={duelOptions} selected={selected} answered={duel.answered} submitting={submitting} seconds={remainingSeconds} total={duelTimerTotal} onAnswer={(id)=>void answerDuel(id)}/>:<CenterMessage badge="Semifinais" title="Acompanhe o telão" text="As duas disputas estão acontecendo ao mesmo tempo."/>
  else if(flow==='semifinal_reveal') content=isFinalist?(duel.resultLoaded?<Reveal correct={Boolean(duel.myResult?.isCorrect)} points={Number(duel.myResult?.pointsAwarded??0)} nextText="A semifinal continua em instantes"/>:<CenterMessage badge="Verificando" title="Conferindo resposta…" text="Aguarde a confirmação do resultado."/>):<CenterMessage badge="Semifinais" title="Acompanhe o telão" text="Resultado da rodada sendo revelado para a sala."/>
  else if(flow==='semifinal_result') content=isFinalist?(isSemiWinner?<CenterMessage badge="Classificado" title="Você está na Final!" text="Parabéns! Aguarde o apresentador iniciar a disputa decisiva."/>:<CenterMessage badge="Semifinal concluída" title="Foi por pouco!" text="Sua participação na disputa terminou aqui. Acompanhe a grande final pelo telão."/>):<CenterMessage badge="Semifinais concluídas" title="Vem aí a Final" text="Acompanhe os dois finalistas pelo telão."/>
  else if(flow==='final_prepare') content=isCurrentFinalPlayer?<Prepare label="Grande Final" seconds={remainingSeconds}/>:<CenterMessage badge="Grande Final" title="Agora é torcida!" text="Os dois finalistas estão prontos. Acompanhe a disputa pelo telão."/>
  else if(flow==='final_question') content=isCurrentFinalPlayer?<QuestionView eyebrow="Grande Final" meta={`${String(duel.player?.display_name??'Você')} × ${String(duel.opponent?.display_name??'adversário')}`} statement={statement(duel.question?.statement)} options={duelOptions} selected={selected} answered={duel.answered} submitting={submitting} seconds={remainingSeconds} total={duelTimerTotal} onAnswer={(id)=>void answerDuel(id)}/>:<CenterMessage badge="Grande Final" title="Acompanhe o telão" text="A disputa decisiva está acontecendo agora."/>
  else if(flow==='final_reveal') content=isCurrentFinalPlayer?(duel.resultLoaded?<Reveal correct={Boolean(duel.myResult?.isCorrect)} points={Number(duel.myResult?.pointsAwarded??0)} nextText="Resultado final em instantes"/>:<CenterMessage badge="Verificando" title="Conferindo resposta…" text="Aguarde a confirmação do resultado."/>):<CenterMessage badge="Grande Final" title="Acompanhe o telão" text="A resposta da final está sendo revelada."/>
  else if(flow==='champion') content=(isCurrentFinalPlayer||isChampion)?(isChampion?<CenterMessage badge="Campeão" title="Você venceu! 🏆" text="Parabéns! Você venceu a dinâmica."/>:<CenterMessage badge="Finalista" title="Que disputa!" text="Você chegou à grande final. Parabéns pela participação!"/>):<CenterMessage badge="Temos um campeão" title="Fim da disputa!" text="Confira o resultado no telão."/>
  else content=<CenterMessage badge={theme.title} title="Acompanhe o telão" text="A dinâmica está seguindo para a próxima etapa."/>

  return <main style={themeStyle(theme)} className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[var(--quiz-bg)] text-white"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(23,77,145,.24),transparent_32%),radial-gradient(circle_at_88%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,var(--quiz-bg)_100%)]"/><Dots/><div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col px-5 py-4"><BrandHeader theme={theme}/>{(!online||error||submissionWarning)&&<div role="status" className={`mt-3 rounded-xl border px-3 py-2.5 text-xs font-semibold ${!online||error?'border-orange-300/35 bg-orange-400/10 text-orange-100':'border-[var(--quiz-secondary)]/35 bg-[var(--quiz-secondary)]/10 text-white'}`}>
     {!online?'Sem conexão. Sua tela será sincronizada automaticamente ao reconectar.':error?'Reconectando ao servidor…':submissionWarning}
    </div>}<div key={`${flow}:${flow?.endsWith("reveal")?currentIdentity:""}`} className="live-mobile-scene flex min-h-0 flex-1 flex-col">{content}</div></div></main>
}
