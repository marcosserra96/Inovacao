import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QuizBrand } from '@/components/quiz/QuizBrand'
import { useQuizVisualTheme, themeStyle } from '@/lib/quizVisualTheme'
import { supabase } from '@/lib/supabase'

type Question={id:string;statement:string;status:string;quizSelected:boolean;semifinalSelected:boolean;finalSelected:boolean;options:{text:string;isCorrect:boolean;position:number}[]}
type Stage='lobby'|'prepare'|'question'|'reveal'|'ranking'|'semifinal_prepare'|'semifinal_question'|'semifinal_reveal'|'semifinal_result'|'final_prepare'|'final_question'|'final_reveal'|'champion'
const stages:Stage[]=['lobby','prepare','question','reveal','ranking','semifinal_prepare','semifinal_question','semifinal_reveal','semifinal_result','final_prepare','final_question','final_reveal','champion']
const names:Record<Stage,string>={lobby:'Lobby',prepare:'Contagem regressiva',question:'Quiz coletivo',reveal:'Revelação',ranking:'Ranking',semifinal_prepare:'Semifinais — apresentação',semifinal_question:'Semifinais — pergunta',semifinal_reveal:'Semifinais — resposta',semifinal_result:'Classificados para a final',final_prepare:'Grande final — apresentação',final_question:'Final — pergunta',final_reveal:'Final — resposta',champion:'Campeão'}
const demoPlayers=['Ana Oliveira','Bruno Costa','Carla Souza','Diego Martins']

export function PresenterSimulationPage(){
 const theme=useQuizVisualTheme()
 const [questions,setQuestions]=useState<Question[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [stage,setStage]=useState<Stage>('lobby')
 const [selected,setSelected]=useState(0)
 const [answer,setAnswer]=useState<number|null>(null)
 const [remaining,setRemaining]=useState(15)
 const [playing,setPlaying]=useState(false)
 const [longText,setLongText]=useState(false)
 const active=useMemo(()=>{
  const pool=questions.filter(q=>q.status==='active'&&
   (stage.startsWith('semifinal')?q.semifinalSelected:stage.startsWith('final')?q.finalSelected:q.quizSelected))
  return pool[selected%Math.max(1,pool.length)]??null
 },[questions,stage,selected])
 const options=active?[...active.options].sort((a,b)=>a.position-b.position):[]
 const questionText=longText?'Uma equipe identificou oportunidades de automatizar atividades manuais repetitivas em diversos setores, reduzir retrabalho, melhorar a qualidade das informações e assegurar acompanhamento dos resultados. Qual das alternativas representa a melhor estratégia para conduzir essa transformação, considerando diferentes áreas, recursos limitados e necessidade de medir os ganhos obtidos?':active?.statement??'Cadastre perguntas nas configurações para visualizar o conteúdo real.'
 useEffect(()=>{
  let mounted=true
  void supabase.rpc('presenter_get_dynamic_config' as never).then(({data,error:err})=>{
   if(!mounted)return
   if(err)setError(err.message)
   else setQuestions(((data as {questions?:Question[]}|null)?.questions??[]))
   setLoading(false)
  })
  return()=>{mounted=false}
 },[])
 useEffect(()=>{
  if(!playing||remaining<=0)return
  const timer=window.setInterval(()=>setRemaining(n=>Math.max(0,n-1)),1000)
  return()=>window.clearInterval(timer)
 },[playing,remaining])
 const jump=(next:Stage)=>{
  setStage(next);setRemaining(next.includes('prepare')?4:20);setPlaying(false);setAnswer(null)
 }
 const next=()=>{
  const index=stages.indexOf(stage)
  if(stage==='ranking'||stage==='final_reveal')setSelected(v=>v+1)
  jump(stages[(index+1)%stages.length])
 }
 const isQuestion=stage.endsWith('question')
 const isReveal=stage.endsWith('reveal')
 const showOptions=isQuestion||isReveal
 const winner=demoPlayers[0]
 const actualCorrect=options.findIndex(o=>o.isCorrect)
 const percentages=[100,84,71,62]
 return <main style={themeStyle(theme)} className="min-h-[100dvh] bg-[var(--quiz-bg)] text-white">
   <div className="mx-auto max-w-7xl px-5 py-6">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/12 pb-5"><QuizBrand theme={theme}/><Link to="/" className="rounded-xl border border-white/20 px-4 py-2 text-sm">Voltar ao portal</Link></header>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-widest text-[var(--quiz-secondary)]">Ambiente seguro de ensaio</div><h1 className="mt-1 text-2xl font-extrabold">Simulador da dinâmica</h1><p className="mt-2 text-sm text-white/55">Sem criar sessões, participantes, respostas ou pontos reais.</p></div><span className="rounded-full border border-[var(--quiz-primary)]/30 px-4 py-2 text-xs font-bold text-[var(--quiz-primary)]">SIMULAÇÃO · Sem gravação</span></div>
    {error&&<p role="alert" className="mt-4 text-red-300">{error}</p>}
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
     <div className="flex min-h-[min(64vh,580px)] flex-col rounded-3xl border border-white/12 bg-[var(--quiz-surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-bold text-[var(--quiz-secondary)]">{names[stage]}</span><span className="text-xs text-white/45">{loading?'Carregando…':questions.filter(q=>q.status==='active').length+' perguntas ativas'}</span></div>
      <div key={stage+':'+selected} className="live-screen-scene flex flex-1 flex-col justify-center py-6">
       {stage==='lobby'&&<div className="text-center"><h2 className="text-5xl font-black">Prontos para começar?</h2><p className="mt-5 text-xl text-white/60">4 participantes fictícios conectados</p></div>}
       {stage.includes('prepare')&&<div className="text-center"><p className="mb-5 text-2xl font-semibold">{stage.startsWith('final')?'GRANDE FINAL':stage.startsWith('semifinal')?'SEMIFINAIS':'PREPARE-SE'}</p><div className="text-8xl font-black text-[var(--quiz-primary)]">{remaining}</div><p className="mt-5 text-white/45">Contagem controlada apenas nesta simulação</p></div>}
       {showOptions&&<div className="mx-auto w-full max-w-4xl"><h2 className="text-[clamp(1.25rem,2.7vw,2.65rem)] font-black leading-tight">{questionText}</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{(options.length?options:[{text:'Alternativa A',isCorrect:true},{text:'Alternativa B',isCorrect:false},{text:'Alternativa C',isCorrect:false},{text:'Alternativa D',isCorrect:false}]).map((o,i)=><button key={i} disabled={isReveal} onClick={()=>setAnswer(i)} className={`min-h-16 rounded-xl border p-4 text-left text-sm font-semibold ${isReveal&&o.isCorrect?'border-[var(--quiz-primary)] bg-[var(--quiz-primary)]/15':answer===i?'border-[var(--quiz-secondary)] bg-[var(--quiz-secondary)]/12':'border-white/15 bg-white/[.035]'}`}><strong className="mr-3 text-[var(--quiz-secondary)]">{String.fromCharCode(65+i)}</strong>{o.text}</button>)}</div>{isReveal&&<p className="live-screen-reveal mt-5 text-center text-xl font-extrabold text-[var(--quiz-primary)]">Resposta correta: {actualCorrect>=0?String.fromCharCode(65+actualCorrect):'A'}</p>}</div>}
       {stage==='ranking'&&<div className="mx-auto w-full max-w-xl space-y-3"><h2 className="mb-5 text-center text-3xl font-black">Ranking parcial</h2>{demoPlayers.map((name,i)=><div key={name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4"><b className="text-[var(--quiz-primary)]">{i+1}º</b><span className="flex-1">{name}</span><span>{percentages[i]*10} pts</span></div>)}</div>}
       {stage==='semifinal_result'&&<div className="text-center"><h2 className="text-4xl font-black">Temos os finalistas!</h2><div className="mt-7 grid gap-4 sm:grid-cols-2">{demoPlayers.slice(0,2).map(n=><div key={n} className="rounded-2xl border border-[var(--quiz-primary)]/35 p-6 text-2xl font-extrabold">{n}</div>)}</div></div>}
       {stage==='champion'&&<div className="text-center"><div className="live-screen-winner mx-auto grid h-28 w-28 place-items-center rounded-full border border-[var(--quiz-primary)] text-6xl">🏆</div><h2 className="live-screen-reveal mt-7 text-5xl font-black text-[var(--quiz-primary)]">{winner}</h2><p className="mt-5 text-xl">Campeão da simulação!</p></div>}
      </div>
     </div>
     <aside className="space-y-4 rounded-3xl border border-white/12 bg-[var(--quiz-surface)] p-5">
      <h2 className="text-lg font-extrabold">Controle de ensaio</h2><label className="block text-xs text-white/60">Etapa a visualizar<select value={stage} onChange={e=>jump(e.target.value as Stage)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-[var(--quiz-bg)] px-2 text-sm text-white">{stages.map(k=><option key={k} value={k}>{names[k]}</option>)}</select></label>
      <label className="block text-xs text-white/60">Pergunta de exemplo<input type="number" min={1} value={selected+1} onChange={e=>setSelected(Math.max(0,Number(e.target.value)-1))} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-[var(--quiz-bg)] px-3 text-white"/></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={longText} onChange={e=>setLongText(e.target.checked)}/>Simular pergunta longa</label>
      <div className="rounded-xl border border-white/10 p-3"><p className="text-xs text-white/50">Cronômetro de teste</p><div className="mt-2 text-2xl font-black">{remaining}s</div><div className="mt-3 flex gap-2"><button onClick={()=>setPlaying(v=>!v)} className="rounded-lg bg-[var(--quiz-primary)] px-4 py-2 text-xs font-bold text-[#07152f]">{playing?'Pausar':'Executar'}</button><button onClick={()=>{setRemaining(20);setPlaying(false)}} className="rounded-lg border border-white/20 px-4 py-2 text-xs">Reiniciar</button></div></div>
      <button onClick={next} className="w-full rounded-xl bg-[var(--quiz-primary)] px-4 py-3 text-sm font-black text-[#07152f]">Próxima etapa</button><button onClick={()=>jump('lobby')} className="w-full rounded-xl border border-white/20 px-4 py-3 text-sm">Reiniciar simulação</button>
      <p className="text-xs leading-relaxed text-white/45">Participantes e pontuações são fictícios. As perguntas usam o banco ativo, mas nada é gravado.</p>
     </aside>
    </div>
   </div>
  </main>
}
