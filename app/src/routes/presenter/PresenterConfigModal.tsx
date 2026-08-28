import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'

type Question = { id: string; statement: string }
type ScoringConfig = { id: string; name: string; isDefault?: boolean }
type Config = {
  selectedQuestionIds: string[]
  questions: Question[]
  scoringConfigs: ScoringConfig[]
  scoringConfigId: string | null
  questionsTotal: number
  questionTimeSeconds: number
  showRankingAfterQuestion: boolean
  hideStatementOnPhone: boolean
  prepareSeconds: number
  revealSeconds: number
  rankingSeconds: number
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: (config: Config) => void
}

export function PresenterConfigModal({ open, onClose, onSaved }: Props) {
  const notify = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<Config | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void supabase.rpc('presenter_get_dynamic_config' as never).then(({ data, error }) => {
      setLoading(false)
      if (error || !data) {
        notify(error?.message ?? 'Não foi possível carregar as configurações.', 'error')
        return
      }
      setConfig(data as unknown as Config)
    })
  }, [open, notify])

  const visibleQuestions = useMemo(() => {
    if (!config) return []
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return config.questions
    return config.questions.filter((question) => question.statement.toLocaleLowerCase('pt-BR').includes(term))
  }, [config, search])

  if (!open) return null

  const toggleQuestion = (id: string) => {
    if (!config) return
    const selected = config.selectedQuestionIds.includes(id)
    const next = selected ? config.selectedQuestionIds.filter((item) => item !== id) : [...config.selectedQuestionIds, id]
    setConfig({ ...config, selectedQuestionIds: next, questionsTotal: Math.min(config.questionsTotal, Math.max(1, next.length)) })
  }

  const save = async () => {
    if (!config) return
    if (!config.selectedQuestionIds.length) {
      notify('Selecione ao menos uma pergunta.', 'error')
      return
    }
    if (!config.scoringConfigId) {
      notify('Selecione uma fórmula de pontuação.', 'error')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('presenter_save_dynamic_config' as never, {
      p_question_ids: config.selectedQuestionIds,
      p_scoring_config_id: config.scoringConfigId,
      p_questions_total: config.questionsTotal,
      p_question_time_seconds: config.questionTimeSeconds,
      p_show_ranking_after_question: config.showRankingAfterQuestion,
      p_hide_statement_on_phone: config.hideStatementOnPhone,
    } as never)
    setSaving(false)
    if (error || !data) {
      notify(error?.message ?? 'Não foi possível salvar a configuração.', 'error')
      return
    }
    const next = data as unknown as Config
    setConfig(next)
    onSaved?.(next)
    notify('Configuração salva.')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#010817]/82 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="grid h-[min(90dvh,820px)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[28px] border border-white/12 bg-[#06152f] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.16em] text-[#00b6da]">Antes de iniciar</div>
            <h2 className="mt-1 font-display text-2xl font-extrabold">Configurações da dinâmica</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-xl text-white/65 hover:bg-white/[.08]">×</button>
        </header>

        {loading || !config ? (
          <div className="grid min-h-0 place-items-center text-white/60">Carregando configurações…</div>
        ) : (
          <div className="grid min-h-0 gap-5 overflow-hidden p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(330px,.65fr)]">
            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 bg-white/[.025] p-4">
              <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
                <div>
                  <div className="text-sm font-bold">Perguntas do quiz</div>
                  <div className="mt-1 text-xs text-white/45">{config.selectedQuestionIds.length} selecionadas · {config.questionsTotal} sorteadas por dinâmica</div>
                </div>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pergunta…" className="h-10 w-full max-w-xs rounded-xl border border-white/10 bg-[#020d23] px-3 text-sm outline-none placeholder:text-white/28 focus:border-[#00b6da]/45" />
              </div>
              <div className="min-h-0 overflow-y-auto pr-1">
                <div className="space-y-2">
                  {visibleQuestions.map((question) => {
                    const checked = config.selectedQuestionIds.includes(question.id)
                    return (
                      <button key={question.id} type="button" onClick={() => toggleQuestion(question.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${checked ? 'border-[#a7d52c]/30 bg-[#a7d52c]/8' : 'border-white/8 bg-white/[.025] hover:bg-white/[.05]'}`}>
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs font-black ${checked ? 'border-[#a7d52c] bg-[#a7d52c] text-[#07152f]' : 'border-white/25 text-transparent'}`}>✓</span>
                        <span className="text-sm leading-snug text-white/82">{question.statement}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
              <Field label="Quantidade de perguntas">
                <input type="number" min={1} max={config.selectedQuestionIds.length || 1} value={config.questionsTotal} onChange={(event) => setConfig({ ...config, questionsTotal: Math.max(1, Math.min(Number(event.target.value), config.selectedQuestionIds.length || 1)) })} className="control" />
              </Field>
              <Field label="Tempo por pergunta">
                <div className="relative"><input type="number" min={5} max={120} value={config.questionTimeSeconds} onChange={(event) => setConfig({ ...config, questionTimeSeconds: Number(event.target.value) })} className="control pr-16"/><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/38">segundos</span></div>
              </Field>
              <Field label="Fórmula de pontuação">
                <select value={config.scoringConfigId ?? ''} onChange={(event) => setConfig({ ...config, scoringConfigId: event.target.value })} className="control">
                  {config.scoringConfigs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>

              <Toggle checked={config.showRankingAfterQuestion} onChange={(checked) => setConfig({ ...config, showRankingAfterQuestion: checked })} title="Mostrar ranking entre perguntas" description="O ranking aparece no telão entre uma pergunta e outra." />
              <Toggle checked={config.hideStatementOnPhone} onChange={(checked) => setConfig({ ...config, hideStatementOnPhone: checked })} title="Ocultar enunciado no celular" description="O participante vê as alternativas e acompanha o enunciado pelo telão." />

              <div className="rounded-2xl border border-[#00b6da]/14 bg-[#00b6da]/6 p-4 text-xs leading-relaxed text-white/58">
                <strong className="text-[#5ddcf2]">Transições automáticas:</strong> Prepare-se em {config.prepareSeconds}s, revelação em {config.revealSeconds}s e ranking em {config.rankingSeconds}s. O Prepare-se permanece fixo em 3 segundos.
              </div>
            </div>
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
          <div className="text-xs text-white/40">As alterações valem para a próxima dinâmica e para uma sessão atual ainda no Lobby.</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-11 rounded-xl border border-white/12 px-5 text-sm font-bold text-white/65 hover:bg-white/[.05]">Cancelar</button>
            <button disabled={saving || loading || !config} onClick={() => void save()} className="h-11 rounded-xl bg-[#a7d52c] px-6 font-display text-sm font-extrabold text-[#07152f] disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar configurações'}</button>
          </div>
        </footer>
      </section>
      <style>{`.control{width:100%;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.10);background:#020d23;padding:0 14px;color:white;outline:none}.control:focus{border-color:rgba(0,182,218,.5)}.control option{background:#06152f}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">{label}</span>{children}</label>
}

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (checked: boolean) => void; title: string; description: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-2xl border border-white/9 bg-white/[.025] p-4 text-left">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#a7d52c]' : 'bg-white/12'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} /></span>
      <span><span className="block text-sm font-bold text-white/84">{title}</span><span className="mt-0.5 block text-xs leading-relaxed text-white/42">{description}</span></span>
    </button>
  )
}
