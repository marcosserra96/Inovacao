import { QuizBrand } from '@/components/quiz/QuizBrand'
import { useQuizVisualTheme, themeStyle, type QuizVisualTheme } from '@/lib/quizVisualTheme'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { PresenterLiveVisualPage } from './PresenterLiveVisualPage'
import { PresenterConfigModal } from './PresenterConfigModal'

function BrandHeader({theme}:{theme:QuizVisualTheme}) {return <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-[clamp(10px,1.7vh,20px)]"><QuizBrand theme={theme}/></header>}

function PlayIcon(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg>}
function SettingsIcon(){return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.3.4.5.8.6 1.3h.09v4H20a1.7 1.7 0 0 0-.6.7Z"/></svg>}

function SetupScreen({onStart,onConfig,busy,theme}:{onStart:()=>void;onConfig:()=>void;busy:boolean;theme:QuizVisualTheme}){
  return <main style={themeStyle(theme)} className="relative h-[100dvh] overflow-hidden bg-[var(--quiz-bg)] text-white"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(23,77,145,.23),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,var(--quiz-bg)_100%)]"/><div className="relative mx-auto grid h-full max-w-[1800px] grid-rows-[auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(10px,1.7vh,22px)]"><BrandHeader theme={theme}/><section className="grid min-h-0 place-items-center py-8"><div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]"><div className="flex flex-col justify-center rounded-[28px] border border-white/12 bg-[var(--quiz-surface)]/78 p-[clamp(24px,4vw,48px)] backdrop-blur-xl"><div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--quiz-primary)]/24 bg-[var(--quiz-primary)]/8 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#c1e944]"><span className="h-2 w-2 rounded-full bg-[var(--quiz-primary)]"/>Pronto para começar</div><h1 className="mt-6 font-display text-[clamp(2.6rem,5.1vw,5.6rem)] font-extrabold leading-[.94] tracking-[-.06em]">Inicie a <span className="text-[var(--quiz-primary)]">dinâmica</span></h1><p className="mt-5 max-w-2xl text-[clamp(1rem,1.3vw,1.3rem)] leading-relaxed text-white/64">Confira perguntas, tempo e ranking. Ao iniciar, o telão abre em outra aba e você continua controlando tudo por aqui.</p><div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]"><button disabled={busy} onClick={onStart} className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-[var(--quiz-primary)] font-display text-xl font-extrabold text-[#07152f] disabled:opacity-50"><PlayIcon/>{busy?'Preparando…':'Iniciar dinâmica'}</button><button onClick={onConfig} className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[.04] px-5 font-display text-sm font-bold text-white/80 hover:bg-white/[.08]"><SettingsIcon/>Configurações</button></div><div className="mt-4 text-xs text-white/42">O telão abre no Lobby; o Quiz só começa quando você autorizar.</div></div><aside className="flex flex-col justify-center rounded-[28px] border border-white/12 bg-[var(--quiz-surface)]/88 p-7"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-[var(--quiz-secondary)]/22 bg-[var(--quiz-secondary)]/7 text-[var(--quiz-secondary)]"><SettingsIcon/></div><h2 className="mt-5 font-display text-2xl font-bold">Antes de começar</h2><div className="mt-5 space-y-4 text-sm text-white/62"><p><strong className="text-white">Perguntas.</strong> Escolha quais entram e quantas serão sorteadas.</p><p><strong className="text-white">Tempo.</strong> Defina o tempo de resposta por pergunta.</p><p><strong className="text-white">Ranking.</strong> Decida se ele aparece no telão entre perguntas.</p></div></aside></div></section></div></main>
}

export function PresenterFlowPreviewPage(){
  const notify=useToast()
  const theme=useQuizVisualTheme()
  const [sessionId,setSessionId]=useState<string|null>(null)
  const [busy,setBusy]=useState(false)
  const [recovering,setRecovering]=useState(true)
  const [configOpen,setConfigOpen]=useState(false)

  useEffect(()=>{
    let active=true
    const recover=async()=>{
      try{
        const {data}=await supabase.from('game_control').select('active_live_quiz_session_id').eq('id',true).maybeSingle()
        const id=(data as any)?.active_live_quiz_session_id as string|undefined
        if(!active)return
        if(id){
          const {data:session}=await supabase.from('live_quiz_sessions').select('id,status,flow_state').eq('id',id).maybeSingle()
          if(active&&session&&(session as any).status!=='finished'&&(session as any).flow_state!=='finished')setSessionId(id)
        }
      }finally{
        if(active)setRecovering(false)
      }
    }
    void recover()
    return()=>{active=false}
  },[])

  const openScreen=(id=sessionId)=>{if(id)window.open(`/telao-dinamica/${id}`,'_blank','noopener,noreferrer')}
  const start=async()=>{setBusy(true);const {data,error}=await supabase.rpc('presenter_prepare_current_dynamic' as never,{p_name:theme.title} as never);setBusy(false);if(error){notify(error.message,'error');return}const result=data as unknown as {sessionId:string};setSessionId(result.sessionId);openScreen(result.sessionId)}

  if(recovering)return <main style={themeStyle(theme)} className="grid h-[100dvh] place-items-center bg-[var(--quiz-bg)] text-white"><div className="text-center"><div className="font-display text-3xl font-extrabold">{theme.title}</div><div className="mt-3 text-sm text-white/50">Recuperando a dinâmica atual…</div></div></main>
  if(sessionId)return <PresenterLiveVisualPage sessionId={sessionId} onOpenScreen={()=>openScreen()} onFinish={()=>setSessionId(null)}/>
  return <><SetupScreen onStart={start} onConfig={()=>setConfigOpen(true)} busy={busy} theme={theme}/><PresenterConfigModal open={configOpen} onClose={()=>setConfigOpen(false)}/></>
}
