import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database, QuestionOrderMode } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type IndividualSessionInsert = Database['public']['Tables']['individual_sessions']['Insert']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

type Props = {
  open: boolean
  session: IndividualSession | null
  questionSets: QuestionSet[]
  scoringConfigs: ScoringConfig[]
  onClose: () => void
  onSaved: () => void
}

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition hover:bg-white/[.055]">
      <span>
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-white/42">{description}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-[#009FC2]' : 'bg-white/12'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  )
}

export function OpenQuizSimpleConfigModal({ open, session, questionSets, scoringConfigs, onClose, onSaved }: Props) {
  const notify = useToast()
  const [name, setName] = useState('')
  const [questionSetId, setQuestionSetId] = useState('')
  const [questionCount, setQuestionCount] = useState(10)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20)
  const [questionOrder, setQuestionOrder] = useState<QuestionOrderMode>('random')
  const [shuffleOptions, setShuffleOptions] = useState(true)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(true)
  const [rankingSize, setRankingSize] = useState(10)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(session?.name ?? 'Quiz Energisa')
    setQuestionSetId(session?.question_set_id ?? questionSets[0]?.id ?? '')
    setQuestionCount(session?.question_count ?? 10)
    setTimeLimitSeconds(session?.time_limit_seconds ?? 20)
    setQuestionOrder(session?.question_order ?? 'random')
    setShuffleOptions(session?.shuffle_options ?? true)
    setShowCorrectAnswer(session?.show_correct_answer ?? true)
    setRankingSize(session?.ranking_size ?? 10)
  }, [open, session, questionSets])

  if (!open) return null

  const save = async () => {
    const scoringConfigId = session?.scoring_config_id ?? scoringConfigs.find((item) => item.is_default)?.id ?? scoringConfigs[0]?.id
    if (!name.trim() || !questionSetId || !scoringConfigId) {
      notify('Cadastre um conjunto de perguntas antes de salvar o quiz.', 'error')
      return
    }

    setSaving(true)
    const payload: IndividualSessionInsert = {
      name: name.trim(),
      question_set_id: questionSetId,
      scoring_config_id: scoringConfigId,
      opens_at: null,
      closes_at: null,
      question_count: Math.max(1, questionCount),
      question_order: questionOrder,
      shuffle_options: shuffleOptions,
      time_limit_seconds: Math.max(5, timeLimitSeconds),
      allow_retry: session?.allow_retry ?? false,
      require_identification: true,
      show_correct_answer: showCorrectAnswer,
      show_ranking: true,
      ranking_size: Math.max(1, rankingSize),
      status: session?.status ?? 'closed',
    }

    const result = session
      ? await supabase.from('individual_sessions').update(payload).eq('id', session.id)
      : await supabase.from('individual_sessions').insert(payload)

    setSaving(false)
    if (result.error) {
      notify(result.error.message, 'error')
      return
    }

    notify(session ? 'Configurações salvas.' : 'Quiz configurado.')
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#010817]/86 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="grid max-h-[94dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[28px] border border-white/12 bg-[#06152f] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.16em] text-[#009FC2]">Quiz Energisa</div>
            <h2 className="mt-1 font-display text-2xl font-extrabold">{session ? 'Configurações' : 'Configure seu quiz'}</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-xl text-white/65 hover:bg-white/[.08]">×</button>
        </header>

        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-white/42">Nome do quiz</label>
              <input value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#020d23] px-4 text-sm font-semibold outline-none focus:border-[#009FC2]/55" />
            </div>

            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <label className="text-xs font-bold uppercase tracking-[.12em] text-white/42">Perguntas</label>
                <div className="flex gap-3 text-xs font-bold">
                  <Link to="/admin/perguntas" className="text-[#58D8ED] hover:text-white">Editar perguntas</Link>
                  <Link to="/admin/conjuntos" className="text-[#58D8ED] hover:text-white">Organizar conjuntos</Link>
                </div>
              </div>
              <select value={questionSetId} onChange={(event) => setQuestionSetId(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#020d23] px-4 text-sm font-semibold outline-none focus:border-[#009FC2]/55">
                {questionSets.length === 0 && <option value="">Nenhum conjunto cadastrado</option>}
                {questionSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-white/42">Perguntas sorteadas</label>
                <input type="number" min={1} value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="h-12 w-full rounded-xl border border-white/10 bg-[#020d23] px-4 text-sm font-semibold outline-none focus:border-[#009FC2]/55" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-white/42">Tempo por pergunta</label>
                <div className="relative">
                  <input type="number" min={5} value={timeLimitSeconds} onChange={(event) => setTimeLimitSeconds(Number(event.target.value))} className="h-12 w-full rounded-xl border border-white/10 bg-[#020d23] px-4 pr-16 text-sm font-semibold outline-none focus:border-[#009FC2]/55" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/35">seg</span>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-white/42">Top do ranking</label>
                <input type="number" min={1} value={rankingSize} onChange={(event) => setRankingSize(Number(event.target.value))} className="h-12 w-full rounded-xl border border-white/10 bg-[#020d23] px-4 text-sm font-semibold outline-none focus:border-[#009FC2]/55" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle checked={questionOrder === 'random'} onChange={(value) => setQuestionOrder(value ? 'random' : 'fixed')} title="Ordem aleatória" description="Sorteia a sequência das perguntas para cada participação." />
              <Toggle checked={shuffleOptions} onChange={setShuffleOptions} title="Embaralhar alternativas" description="Muda a posição das respostas no celular." />
              <Toggle checked={showCorrectAnswer} onChange={setShowCorrectAnswer} title="Mostrar resposta correta" description="Exibe a resposta depois que a pessoa responder." />
            </div>

            <div className="rounded-2xl border border-[#F37021]/18 bg-[#F37021]/7 p-4 text-sm leading-relaxed text-white/58">
              <strong className="text-[#FFA56F]">Simples de operar:</strong> abrir e fechar respostas, zerar ranking e abrir o telão ficam todos na tela principal. Aqui ficam só as regras que você normalmente ajusta antes do evento.
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4 sm:px-6">
          <button onClick={onClose} className="h-11 rounded-xl border border-white/12 px-5 text-sm font-bold text-white/65 hover:bg-white/[.05]">Cancelar</button>
          <button disabled={saving || questionSets.length === 0 || scoringConfigs.length === 0} onClick={() => void save()} className="h-11 rounded-xl bg-[#F37021] px-6 font-display text-sm font-extrabold text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar configurações'}</button>
        </footer>
      </section>
    </div>
  )
}
