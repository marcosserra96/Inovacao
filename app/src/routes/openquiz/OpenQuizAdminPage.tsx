import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { OpenQuizSimpleConfigModal } from './OpenQuizSimpleConfigModal'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type IndividualSessionInsert = Database['public']['Tables']['individual_sessions']['Insert']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

function BrandHeader() {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 pb-[clamp(10px,1.7vh,20px)]">
      <div className="flex min-w-0 items-center gap-[clamp(12px,1.4vw,20px)]">
        <div className="font-display text-[clamp(1.45rem,2.15vw,2.55rem)] font-extrabold tracking-[-0.04em]">
          <span className="text-[#009FC2]">Quiz </span><span className="text-white">Energisa</span>
        </div>
        <div className="hidden h-9 w-px bg-white/30 sm:block" />
        <div className="hidden text-sm font-medium text-white/75 sm:block md:text-base">Painel do Apresentador</div>
      </div>
      <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-[clamp(28px,4.2vh,42px)] w-auto" />
      <div className="absolute -bottom-px left-0 h-px w-[42%] bg-gradient-to-r from-[#009FC2] via-[#35B9D2] to-[#F37021]" />
    </header>
  )
}

function PlayIcon(){return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg>}
function SettingsIcon(){return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.3.4.5.8.6 1.3h.09v4H20a1.7 1.7 0 0 0-.6.7Z"/></svg>}
function ScreenIcon(){return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
function ResetIcon(){return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/></svg>}

export function OpenQuizAdminPage() {
  const notify = useToast()
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [scoringConfigs, setScoringConfigs] = useState<ScoringConfig[]>([])
  const [configOpen, setConfigOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [s, qs, sc] = await Promise.all([
      supabase.from('individual_sessions').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('question_sets').select('*').order('name'),
      supabase.from('scoring_configs').select('*').order('created_at'),
    ])
    setSession(s.data ?? null)
    setQuestionSets(qs.data ?? [])
    setScoringConfigs(sc.data ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function toggleAnswers() {
    if (!session) {
      setConfigOpen(true)
      return
    }
    setBusy(true)
    const opening = session.status !== 'open'
    const update: Database['public']['Tables']['individual_sessions']['Update'] = opening
      ? { status: 'open', opens_at: null, closes_at: null }
      : { status: 'closed' }
    const { error } = await supabase.from('individual_sessions').update(update).eq('id', session.id)
    setBusy(false)
    if (error) return notify(error.message, 'error')
    notify(opening ? 'Respostas abertas.' : 'Respostas fechadas.')
    void load()
  }

  async function resetRanking() {
    if (!session) return
    if (!confirm('Zerar o ranking e começar uma nova rodada?')) return

    setBusy(true)
    const payload: IndividualSessionInsert = {
      name: session.name,
      question_set_id: session.question_set_id,
      scoring_config_id: session.scoring_config_id,
      opens_at: null,
      closes_at: null,
      question_count: session.question_count,
      question_order: session.question_order,
      shuffle_options: session.shuffle_options,
      time_limit_seconds: session.time_limit_seconds,
      allow_retry: session.allow_retry,
      require_identification: session.require_identification,
      show_correct_answer: session.show_correct_answer,
      show_ranking: session.show_ranking,
      ranking_size: session.ranking_size,
      status: session.status === 'open' ? 'open' : 'closed',
    }
    const { error } = await supabase.from('individual_sessions').insert(payload)
    setBusy(false)
    if (error) return notify(error.message, 'error')
    notify('Ranking zerado. Nova rodada pronta.')
    void load()
  }

  const configured = Boolean(session)
  const open = session?.status === 'open'
  const canConfigure = questionSets.length > 0 && scoringConfigs.length > 0

  return (
    <>
      <main className="relative h-[100dvh] overflow-hidden bg-[#020d23] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(0,159,194,.20),transparent_32%),radial-gradient(circle_at_83%_20%,rgba(243,112,33,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] opacity-35 [background-image:radial-gradient(circle,#009FC2_1.5px,transparent_1.6px)] [background-size:18px_18px] [mask-image:linear-gradient(to_top,black,transparent)]" />

        <div className="relative mx-auto grid h-full max-w-[1800px] grid-rows-[auto_minmax(0,1fr)] px-[clamp(14px,2.2vw,40px)] py-[clamp(10px,1.7vh,22px)]">
          <BrandHeader />

          <section className="grid min-h-0 place-items-center py-8">
            <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
              <div className="flex flex-col justify-center rounded-[28px] border border-white/12 bg-[#071936]/78 p-[clamp(24px,4vw,48px)] backdrop-blur-xl">
                <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] ${open ? 'border-[#009FC2]/25 bg-[#009FC2]/8 text-[#58D8ED]' : 'border-[#F37021]/25 bg-[#F37021]/8 text-[#FFA56F]'}`}>
                  <span className={`h-2 w-2 rounded-full ${open ? 'bg-[#009FC2]' : 'bg-[#F37021]'}`} />
                  {loading ? 'Carregando' : !configured ? 'Ainda não configurado' : open ? 'Aceitando respostas' : 'Respostas fechadas'}
                </div>

                <h1 className="mt-6 font-display text-[clamp(2.6rem,5.1vw,5.6rem)] font-extrabold leading-[.94] tracking-[-.06em]">
                  {configured ? <>Controle seu <span className="text-[#009FC2]">quiz</span></> : <>Prepare seu <span className="text-[#009FC2]">quiz</span></>}
                </h1>

                <p className="mt-5 max-w-2xl text-[clamp(1rem,1.3vw,1.3rem)] leading-relaxed text-white/64">
                  {configured
                    ? <><strong className="text-white">{session?.name}</strong> · {session?.question_count} perguntas · {session?.time_limit_seconds ?? '—'}s por pergunta. O QR do telão continua sempre o mesmo.</>
                    : 'Escolha as perguntas, o tempo e as regras principais. Depois é só abrir as respostas e deixar o telão projetado.'}
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <button disabled={busy || loading || (!configured && !canConfigure)} onClick={() => void toggleAnswers()} className={`flex h-16 items-center justify-center gap-3 rounded-2xl font-display text-xl font-extrabold disabled:opacity-40 ${open ? 'border border-[#F37021]/30 bg-[#F37021]/10 text-[#FFA56F]' : 'bg-[#F37021] text-white shadow-[0_14px_40px_rgba(243,112,33,.18)]'}`}>
                    <PlayIcon />{!configured ? 'Configurar quiz' : open ? 'Fechar respostas' : 'Abrir respostas'}
                  </button>
                  <button onClick={() => setConfigOpen(true)} className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[.04] px-5 font-display text-sm font-bold text-white/80 hover:bg-white/[.08]">
                    <SettingsIcon />Configurações
                  </button>
                </div>

                {!canConfigure && !loading && (
                  <div className="mt-4 text-xs text-[#FFA56F]">
                    Cadastre ao menos um conjunto de perguntas e uma fórmula de pontuação para iniciar.
                  </div>
                )}
              </div>

              <aside className="flex flex-col justify-center rounded-[28px] border border-white/12 bg-[#071936]/88 p-7">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#009FC2]/22 bg-[#009FC2]/7 text-[#58D8ED]"><ScreenIcon /></div>
                <h2 className="mt-5 font-display text-2xl font-bold">Durante o evento</h2>

                <div className="mt-5 space-y-3">
                  <Link to="/telao" target="_blank" className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] px-4 text-sm font-bold text-white/78 hover:bg-white/[.065]">
                    <ScreenIcon /><span>Abrir telão</span>
                  </Link>
                  <button disabled={!session || busy} onClick={() => void resetRanking()} className="flex h-12 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] px-4 text-sm font-bold text-white/78 hover:bg-white/[.065] disabled:opacity-35">
                    <ResetIcon /><span>Zerar ranking</span>
                  </button>
                  <Link to="/participar" target="_blank" className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] px-4 text-sm font-bold text-white/78 hover:bg-white/[.065]">
                    <PlayIcon /><span>Testar como participante</span>
                  </Link>
                </div>

                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="text-[10px] font-bold uppercase tracking-[.14em] text-white/35">Manutenção</div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">
                    <Link to="/admin/perguntas" className="text-[#58D8ED] hover:text-white">Perguntas</Link>
                    <Link to="/admin/conjuntos" className="text-[#58D8ED] hover:text-white">Conjuntos</Link>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>

      <OpenQuizSimpleConfigModal
        open={configOpen}
        session={session}
        questionSets={questionSets}
        scoringConfigs={scoringConfigs}
        onClose={() => setConfigOpen(false)}
        onSaved={() => void load()}
      />
    </>
  )
}
