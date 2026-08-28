import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'

type QuestionOption = {
  id: string
  text: string
  isCorrect: boolean
  position: number
}

type Question = {
  id: string
  statement: string
  explanation: string | null
  status: 'active' | 'inactive' | 'archived'
  type: string
  difficulty: string
  basePoints: number
  quizSelected: boolean
  semifinalSelected: boolean
  finalSelected: boolean
  used: boolean
  options: QuestionOption[]
}

type Config = {
  questions: Question[]
  questionsTotal: number
  questionTimeSeconds: number
  duelRoundsTotal: number
  finalRoundsTotal: number
  showRankingAfterQuestion: boolean
  hideStatementOnPhone: boolean
  enableSpeedBonus: boolean
  endWhenAllAnswered: boolean
  prepareSeconds: number
  revealSeconds: number
  rankingSeconds: number
}

type Settings = Pick<
  Config,
  | 'questionsTotal'
  | 'questionTimeSeconds'
  | 'duelRoundsTotal'
  | 'finalRoundsTotal'
  | 'showRankingAfterQuestion'
  | 'hideStatementOnPhone'
  | 'enableSpeedBonus'
  | 'endWhenAllAnswered'
>

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: (config: Config) => void
}

type DraftOption = { text: string; isCorrect: boolean }
type QuestionDraft = {
  id: string | null
  statement: string
  explanation: string
  options: DraftOption[]
  useInQuiz: boolean
  useInSemifinal: boolean
  useInFinal: boolean
  used: boolean
}

function settingsFromConfig(config: Config): Settings {
  return {
    questionsTotal: config.questionsTotal,
    questionTimeSeconds: config.questionTimeSeconds,
    duelRoundsTotal: config.duelRoundsTotal,
    finalRoundsTotal: config.finalRoundsTotal,
    showRankingAfterQuestion: config.showRankingAfterQuestion,
    hideStatementOnPhone: config.hideStatementOnPhone,
    enableSpeedBonus: config.enableSpeedBonus,
    endWhenAllAnswered: config.endWhenAllAnswered,
  }
}

function newQuestionDraft(): QuestionDraft {
  return {
    id: null,
    statement: '',
    explanation: '',
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
    useInQuiz: true,
    useInSemifinal: true,
    useInFinal: true,
    used: false,
  }
}

function questionToDraft(question: Question): QuestionDraft {
  return {
    id: question.id,
    statement: question.statement,
    explanation: question.explanation ?? '',
    options: question.options
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
    useInQuiz: question.quizSelected,
    useInSemifinal: question.semifinalSelected,
    useInFinal: question.finalSelected,
    used: question.used,
  }
}

export function PresenterConfigModal({ open, onClose, onSaved }: Props) {
  const notify = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [questionSaving, setQuestionSaving] = useState(false)
  const [config, setConfig] = useState<Config | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<'questions' | 'dynamic'>('questions')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [draft, setDraft] = useState<QuestionDraft | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setDraft(null)
    setTab('questions')
    void supabase.rpc('presenter_get_dynamic_config' as never).then(({ data, error }) => {
      setLoading(false)
      if (error || !data) {
        notify(error?.message ?? 'Não foi possível carregar as configurações.', 'error')
        return
      }
      const next = data as unknown as Config
      setConfig(next)
      setSettings(settingsFromConfig(next))
    })
  }, [open, notify])

  const activeQuestions = useMemo(
    () => config?.questions.filter((question) => question.status === 'active') ?? [],
    [config],
  )
  const quizPool = activeQuestions.filter((question) => question.quizSelected)
  const semifinalPool = activeQuestions.filter((question) => question.semifinalSelected)
  const finalPool = activeQuestions.filter((question) => question.finalSelected)

  const visibleQuestions = useMemo(() => {
    if (!config) return []
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return config.questions.filter((question) => {
      if (filter === 'active' && question.status !== 'active') return false
      if (filter === 'archived' && question.status === 'active') return false
      if (term && !question.statement.toLocaleLowerCase('pt-BR').includes(term)) return false
      return true
    })
  }, [config, search, filter])

  if (!open) return null

  const refreshFromQuestionChange = (next: Config) => {
    setConfig(next)
    setSettings((current) => {
      const base = current ?? settingsFromConfig(next)
      const nextQuiz = next.questions.filter((question) => question.status === 'active' && question.quizSelected).length
      const nextSemis = next.questions.filter((question) => question.status === 'active' && question.semifinalSelected).length
      const nextFinal = next.questions.filter((question) => question.status === 'active' && question.finalSelected).length
      return {
        ...base,
        questionsTotal: Math.min(base.questionsTotal, Math.max(1, nextQuiz)),
        duelRoundsTotal: Math.min(base.duelRoundsTotal, Math.max(1, nextSemis)),
        finalRoundsTotal: Math.min(base.finalRoundsTotal, Math.max(1, nextFinal)),
      }
    })
  }

  const saveQuestion = async () => {
    if (!draft) return
    if (!draft.statement.trim()) {
      notify('Digite o enunciado da pergunta.', 'error')
      return
    }
    if (draft.options.length < 2 || draft.options.some((option) => !option.text.trim())) {
      notify('Preencha pelo menos duas alternativas.', 'error')
      return
    }
    if (draft.options.filter((option) => option.isCorrect).length !== 1) {
      notify('Marque exatamente uma alternativa correta.', 'error')
      return
    }
    if (!draft.useInQuiz && !draft.useInSemifinal && !draft.useInFinal) {
      notify('Escolha pelo menos uma etapa em que a pergunta será usada.', 'error')
      return
    }

    setQuestionSaving(true)
    const { data, error } = await supabase.rpc('presenter_upsert_dynamic_question' as never, {
      p_question_id: draft.id,
      p_statement: draft.statement.trim(),
      p_explanation: draft.explanation.trim() || null,
      p_options: draft.options.map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect })),
      p_use_in_quiz: draft.useInQuiz,
      p_use_in_semifinal: draft.useInSemifinal,
      p_use_in_final: draft.useInFinal,
    } as never)
    setQuestionSaving(false)

    if (error || !data) {
      notify(error?.message ?? 'Não foi possível salvar a pergunta.', 'error')
      return
    }

    refreshFromQuestionChange(data as unknown as Config)
    notify(draft.id ? 'Pergunta atualizada.' : 'Pergunta criada.')
    setDraft(null)
  }

  const removeQuestion = async (question: Question) => {
    const text = question.used
      ? 'Esta pergunta já foi usada em uma dinâmica. Ela será arquivada para preservar o histórico. Continuar?'
      : 'Excluir esta pergunta definitivamente? Essa ação não pode ser desfeita.'
    if (!window.confirm(text)) return

    const { data, error } = await supabase.rpc('presenter_delete_dynamic_question' as never, {
      p_question_id: question.id,
    } as never)
    if (error || !data) {
      notify(error?.message ?? 'Não foi possível excluir a pergunta.', 'error')
      return
    }
    refreshFromQuestionChange(data as unknown as Config)
    notify(question.used ? 'Pergunta arquivada. O histórico foi preservado.' : 'Pergunta excluída.')
  }

  const restoreQuestion = async (question: Question) => {
    const { data, error } = await supabase.rpc('presenter_restore_dynamic_question' as never, {
      p_question_id: question.id,
    } as never)
    if (error || !data) {
      notify(error?.message ?? 'Não foi possível reativar a pergunta.', 'error')
      return
    }
    refreshFromQuestionChange(data as unknown as Config)
    notify('Pergunta reativada. Edite-a para escolher em quais etapas será usada.')
  }

  const saveDynamic = async () => {
    if (!config || !settings) return
    const quizIds = config.questions.filter((q) => q.status === 'active' && q.quizSelected).map((q) => q.id)
    const semifinalIds = config.questions.filter((q) => q.status === 'active' && q.semifinalSelected).map((q) => q.id)
    const finalIds = config.questions.filter((q) => q.status === 'active' && q.finalSelected).map((q) => q.id)

    if (!quizIds.length || !semifinalIds.length || !finalIds.length) {
      notify('Quiz, semifinais e final precisam ter pelo menos uma pergunta disponível.', 'error')
      return
    }

    setSaving(true)
    const { data, error } = await supabase.rpc('presenter_save_dynamic_config_v2' as never, {
      p_quiz_question_ids: quizIds,
      p_semifinal_question_ids: semifinalIds,
      p_final_question_ids: finalIds,
      p_questions_total: Math.min(settings.questionsTotal, quizIds.length),
      p_question_time_seconds: settings.questionTimeSeconds,
      p_duel_rounds_total: Math.min(settings.duelRoundsTotal, semifinalIds.length),
      p_final_rounds_total: Math.min(settings.finalRoundsTotal, finalIds.length),
      p_show_ranking_after_question: settings.showRankingAfterQuestion,
      p_hide_statement_on_phone: settings.hideStatementOnPhone,
      p_enable_speed_bonus: settings.enableSpeedBonus,
      p_end_when_all_answered: settings.endWhenAllAnswered,
    } as never)
    setSaving(false)

    if (error || !data) {
      notify(error?.message ?? 'Não foi possível salvar a dinâmica.', 'error')
      return
    }

    const next = data as unknown as Config
    setConfig(next)
    setSettings(settingsFromConfig(next))
    onSaved?.(next)
    notify('Configuração da dinâmica salva.')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#010817]/86 p-3 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !draft && onClose()}>
      <section className="relative grid h-[min(94dvh,900px)] w-full max-w-7xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[28px] border border-white/12 bg-[#06152f] text-white shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.16em] text-[#00b6da]">Preparação da dinâmica</div>
            <h2 className="mt-1 font-display text-2xl font-extrabold">Perguntas e regras do jogo</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-[#020d23] p-1">
              <TabButton active={tab === 'questions'} onClick={() => setTab('questions')}>Perguntas</TabButton>
              <TabButton active={tab === 'dynamic'} onClick={() => setTab('dynamic')}>Dinâmica</TabButton>
            </div>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-xl text-white/65 hover:bg-white/[.08]">×</button>
          </div>
        </header>

        {loading || !config || !settings ? (
          <div className="grid min-h-0 place-items-center text-white/60">Carregando configurações…</div>
        ) : tab === 'questions' ? (
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-5 sm:p-6">
            <div className="grid gap-4 pb-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <SummaryPill label="Ativas" value={activeQuestions.length} />
                  <SummaryPill label="Quiz" value={quizPool.length} tone="lime" />
                  <SummaryPill label="Semifinais" value={semifinalPool.length} tone="cyan" />
                  <SummaryPill label="Final" value={finalPool.length} tone="orange" />
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/48">Cadastre e mantenha o banco de perguntas aqui. Ao editar uma pergunta já utilizada, o histórico anterior é preservado automaticamente.</p>
              </div>
              <button type="button" onClick={() => setDraft(newQuestionDraft())} className="h-11 rounded-xl bg-[#a7d52c] px-5 font-display text-sm font-extrabold text-[#07152f]">+ Nova pergunta</button>
            </div>

            <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
              <div className="flex flex-wrap gap-2 border-b border-white/8 p-3">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pergunta…" className="h-10 min-w-[220px] flex-1 rounded-xl border border-white/10 bg-[#020d23] px-3 text-sm outline-none placeholder:text-white/28 focus:border-[#00b6da]/45" />
                <FilterButton active={filter === 'active'} onClick={() => setFilter('active')}>Ativas</FilterButton>
                <FilterButton active={filter === 'archived'} onClick={() => setFilter('archived')}>Arquivadas</FilterButton>
                <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Todas</FilterButton>
              </div>

              <div className="min-h-0 overflow-y-auto p-3">
                {visibleQuestions.length === 0 ? (
                  <div className="grid h-full min-h-48 place-items-center text-sm text-white/42">Nenhuma pergunta encontrada.</div>
                ) : (
                  <div className="space-y-2.5">
                    {visibleQuestions.map((question) => (
                      <QuestionRow
                        key={question.id}
                        question={question}
                        onEdit={() => setDraft(questionToDraft(question))}
                        onDelete={() => void removeQuestion(question)}
                        onRestore={() => void restoreQuestion(question)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
              <StageCard eyebrow="Etapa 1" title="Quiz coletivo" description={`${quizPool.length} perguntas disponíveis no banco`}>
                <NumberField label="Perguntas sorteadas" value={settings.questionsTotal} min={1} max={Math.max(1, quizPool.length)} onChange={(value) => setSettings({ ...settings, questionsTotal: value })} suffix={`de ${quizPool.length}`} />
                <NumberField label="Tempo para responder" value={settings.questionTimeSeconds} min={5} max={120} onChange={(value) => setSettings({ ...settings, questionTimeSeconds: value })} suffix="segundos" />
              </StageCard>

              <StageCard eyebrow="Etapas finais" title="Semifinais e final" description="Os 4 melhores avançam automaticamente para o chaveamento">
                <NumberField label="Perguntas por semifinal" value={settings.duelRoundsTotal} min={1} max={Math.max(1, semifinalPool.length)} onChange={(value) => setSettings({ ...settings, duelRoundsTotal: value })} suffix={`de ${semifinalPool.length}`} />
                <NumberField label="Perguntas na final" value={settings.finalRoundsTotal} min={1} max={Math.max(1, finalPool.length)} onChange={(value) => setSettings({ ...settings, finalRoundsTotal: value })} suffix={`de ${finalPool.length}`} />
              </StageCard>

              <StageCard eyebrow="Ritmo" title="Comportamento das perguntas" description="Regras que afetam a velocidade da dinâmica">
                <Toggle checked={settings.endWhenAllAnswered} onChange={(checked) => setSettings({ ...settings, endWhenAllAnswered: checked })} title="Encerrar quando todos responderem" description="Não espera o cronômetro chegar a zero se todas as respostas já chegaram." />
                <Toggle checked={settings.enableSpeedBonus} onChange={(checked) => setSettings({ ...settings, enableSpeedBonus: checked })} title="Valorizar respostas mais rápidas" description="Além de acertar, responder antes rende mais pontos." />
              </StageCard>

              <StageCard eyebrow="Exibição" title="O que aparece durante o jogo" description="Ajustes de telão e celular dos participantes">
                <Toggle checked={settings.showRankingAfterQuestion} onChange={(checked) => setSettings({ ...settings, showRankingAfterQuestion: checked })} title="Mostrar ranking entre perguntas" description="Exibe o Top 10 no telão antes da próxima pergunta." />
                <Toggle checked={!settings.hideStatementOnPhone} onChange={(checked) => setSettings({ ...settings, hideStatementOnPhone: !checked })} title="Mostrar enunciado no celular" description="Se desligado, o participante vê as alternativas e acompanha o enunciado pelo telão." />
              </StageCard>

              <div className="lg:col-span-2 rounded-2xl border border-[#00b6da]/14 bg-[#00b6da]/6 p-4 text-sm leading-relaxed text-white/58">
                <strong className="text-[#5ddcf2]">Transições automáticas:</strong> Prepare-se {config.prepareSeconds}s · resposta revelada {config.revealSeconds}s · ranking {config.rankingSeconds}s. Esses tempos ficam padronizados para manter o ritmo do evento.
              </div>
            </div>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
          <div className="text-xs text-white/40">Perguntas são salvas individualmente. As regras da dinâmica valem para a próxima sessão e para uma sessão ainda no Lobby.</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-11 rounded-xl border border-white/12 px-5 text-sm font-bold text-white/65 hover:bg-white/[.05]">Fechar</button>
            <button disabled={saving || loading || !config || !settings} onClick={() => void saveDynamic()} className="h-11 rounded-xl bg-[#a7d52c] px-6 font-display text-sm font-extrabold text-[#07152f] disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar regras da dinâmica'}</button>
          </div>
        </footer>

        {draft && (
          <QuestionEditor
            draft={draft}
            saving={questionSaving}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={() => void saveQuestion()}
          />
        )}
      </section>
    </div>
  )
}

function QuestionEditor({ draft, saving, onChange, onCancel, onSave }: { draft: QuestionDraft; saving: boolean; onChange: (draft: QuestionDraft) => void; onCancel: () => void; onSave: () => void }) {
  const updateOption = (index: number, patch: Partial<DraftOption>) => {
    onChange({ ...draft, options: draft.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) })
  }
  const setCorrect = (index: number) => {
    onChange({ ...draft, options: draft.options.map((option, optionIndex) => ({ ...option, isCorrect: optionIndex === index })) })
  }
  const removeOption = (index: number) => {
    if (draft.options.length <= 2) return
    const next = draft.options.filter((_, optionIndex) => optionIndex !== index)
    if (!next.some((option) => option.isCorrect)) next[0] = { ...next[0], isCorrect: true }
    onChange({ ...draft, options: next })
  }

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[#010817]/92 p-3 backdrop-blur-md">
      <div className="grid h-[min(88dvh,780px)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[26px] border border-white/12 bg-[#071936] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#00b6da]">Banco de perguntas</div>
            <h3 className="mt-1 font-display text-xl font-extrabold">{draft.id ? 'Editar pergunta' : 'Nova pergunta'}</h3>
            {draft.used && <p className="mt-1 text-xs text-[#c1e944]">Esta pergunta já foi usada. Ao salvar, uma nova versão será criada e o histórico ficará intacto.</p>}
          </div>
          <button onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-xl text-white/60">×</button>
        </header>

        <div className="min-h-0 space-y-5 overflow-y-auto p-5 sm:p-6">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-white/58">Enunciado</span>
            <textarea rows={3} value={draft.statement} onChange={(event) => onChange({ ...draft, statement: event.target.value })} className="w-full resize-none rounded-2xl border border-white/10 bg-[#020d23] p-4 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-[#00b6da]/45" placeholder="Digite a pergunta…" />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-white/58">Alternativas</span>
              {draft.options.length < 6 && <button type="button" onClick={() => onChange({ ...draft, options: [...draft.options, { text: '', isCorrect: false }] })} className="text-xs font-bold text-[#5ddcf2] hover:text-white">+ Adicionar alternativa</button>}
            </div>
            <div className="space-y-2">
              {draft.options.map((option, index) => (
                <div key={index} className={`flex items-center gap-2 rounded-xl border p-2 ${option.isCorrect ? 'border-[#a7d52c]/35 bg-[#a7d52c]/7' : 'border-white/8 bg-white/[.025]'}`}>
                  <button type="button" onClick={() => setCorrect(index)} className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-black ${option.isCorrect ? 'border-[#a7d52c] bg-[#a7d52c] text-[#07152f]' : 'border-white/20 text-white/24'}`}>✓</button>
                  <input value={option.text} onChange={(event) => updateOption(index, { text: event.target.value })} className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-white/24" placeholder={`Alternativa ${index + 1}`} />
                  {draft.options.length > 2 && <button type="button" onClick={() => removeOption(index)} className="grid h-8 w-8 place-items-center rounded-lg text-white/35 hover:bg-white/[.06] hover:text-white">×</button>}
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-white/36">Clique no ✓ para marcar a resposta correta.</div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-white/58">Explicação após a resposta <span className="font-normal text-white/30">(opcional)</span></span>
            <textarea rows={2} value={draft.explanation} onChange={(event) => onChange({ ...draft, explanation: event.target.value })} className="w-full resize-none rounded-2xl border border-white/10 bg-[#020d23] p-4 text-sm leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-[#00b6da]/45" placeholder="Uma explicação curta para reforçar o aprendizado…" />
          </label>

          <div>
            <div className="mb-2 text-xs font-semibold text-white/58">Usar esta pergunta em</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <StageToggle checked={draft.useInQuiz} onClick={() => onChange({ ...draft, useInQuiz: !draft.useInQuiz })} label="Quiz coletivo" />
              <StageToggle checked={draft.useInSemifinal} onClick={() => onChange({ ...draft, useInSemifinal: !draft.useInSemifinal })} label="Semifinais" />
              <StageToggle checked={draft.useInFinal} onClick={() => onChange({ ...draft, useInFinal: !draft.useInFinal })} label="Final" />
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-white/10 px-5 py-4 sm:px-6">
          <button type="button" onClick={onCancel} disabled={saving} className="h-11 rounded-xl border border-white/12 px-5 text-sm font-bold text-white/65 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={onSave} disabled={saving} className="h-11 rounded-xl bg-[#a7d52c] px-6 font-display text-sm font-extrabold text-[#07152f] disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar pergunta'}</button>
        </footer>
      </div>
    </div>
  )
}

function QuestionRow({ question, onEdit, onDelete, onRestore }: { question: Question; onEdit: () => void; onDelete: () => void; onRestore: () => void }) {
  const isActive = question.status === 'active'
  return (
    <div className={`grid gap-3 rounded-2xl border p-4 transition lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${isActive ? 'border-white/8 bg-white/[.025] hover:border-white/14' : 'border-white/6 bg-black/10 opacity-70'}`}>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white/84">{question.statement}</p>
          {question.used && <span className="shrink-0 rounded-md border border-white/10 bg-white/[.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/38">Histórico</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {isActive ? (
            <>
              {question.quizSelected && <StageBadge tone="lime">Quiz</StageBadge>}
              {question.semifinalSelected && <StageBadge tone="cyan">Semifinais</StageBadge>}
              {question.finalSelected && <StageBadge tone="orange">Final</StageBadge>}
              {!question.quizSelected && !question.semifinalSelected && !question.finalSelected && <StageBadge>Fora da dinâmica</StageBadge>}
            </>
          ) : <StageBadge>{question.status === 'archived' ? 'Arquivada' : 'Inativa'}</StageBadge>}
          <span className="rounded-md bg-white/[.035] px-2 py-1 text-[10px] text-white/35">{question.options.length} alternativas</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <>
            <button onClick={onEdit} className="h-9 rounded-lg border border-white/10 bg-white/[.035] px-3 text-xs font-bold text-white/70 hover:bg-white/[.07]">Editar</button>
            <button onClick={onDelete} className="h-9 rounded-lg border border-red-400/15 bg-red-400/[.05] px-3 text-xs font-bold text-red-200/70 hover:bg-red-400/[.1]">Excluir</button>
          </>
        ) : (
          <button onClick={onRestore} className="h-9 rounded-lg border border-[#a7d52c]/20 bg-[#a7d52c]/7 px-3 text-xs font-bold text-[#c1e944]">Reativar</button>
        )}
      </div>
    </div>
  )
}

function StageCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="text-[10px] font-bold uppercase tracking-[.15em] text-[#00b6da]">{eyebrow}</div>
      <h3 className="mt-1 font-display text-xl font-extrabold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-white/40">{description}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function NumberField({ label, value, min, max, onChange, suffix }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; suffix: string }) {
  const clamp = (next: number) => Math.max(min, Math.min(max, Number.isFinite(next) ? next : min))
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-white/55">{label}</span>
      <div className="relative">
        <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(clamp(Number(event.target.value)))} className="h-11 w-full rounded-xl border border-white/10 bg-[#020d23] px-3 pr-24 text-sm text-white outline-none focus:border-[#00b6da]/45" />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/32">{suffix}</span>
      </div>
    </label>
  )
}

function Toggle({ checked, onChange, title, description }: { checked: boolean; onChange: (checked: boolean) => void; title: string; description: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-[#020d23]/55 p-3 text-left">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#a7d52c]' : 'bg-white/12'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} /></span>
      <span><span className="block text-sm font-bold text-white/82">{title}</span><span className="mt-0.5 block text-xs leading-relaxed text-white/38">{description}</span></span>
    </button>
  )
}

function StageToggle({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${checked ? 'border-[#a7d52c]/35 bg-[#a7d52c]/10 text-[#c1e944]' : 'border-white/10 bg-white/[.025] text-white/42'}`}><span className={`grid h-5 w-5 place-items-center rounded-md border text-[10px] ${checked ? 'border-[#a7d52c] bg-[#a7d52c] text-[#07152f]' : 'border-white/20 text-transparent'}`}>✓</span>{label}</button>
}

function StageBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'lime' | 'cyan' | 'orange' }) {
  const classes = tone === 'lime' ? 'border-[#a7d52c]/18 bg-[#a7d52c]/8 text-[#c1e944]' : tone === 'cyan' ? 'border-[#00b6da]/18 bg-[#00b6da]/8 text-[#5ddcf2]' : tone === 'orange' ? 'border-[#f37021]/18 bg-[#f37021]/8 text-[#ff9a5c]' : 'border-white/10 bg-white/[.035] text-white/42'
  return <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${classes}`}>{children}</span>
}

function SummaryPill({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'lime' | 'cyan' | 'orange' }) {
  const classes = tone === 'lime' ? 'border-[#a7d52c]/20 bg-[#a7d52c]/8 text-[#c1e944]' : tone === 'cyan' ? 'border-[#00b6da]/20 bg-[#00b6da]/8 text-[#5ddcf2]' : tone === 'orange' ? 'border-[#f37021]/20 bg-[#f37021]/8 text-[#ff9a5c]' : 'border-white/10 bg-white/[.035] text-white/60'
  return <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${classes}`}>{label} <span className="ml-1 text-white">{value}</span></div>
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`h-10 rounded-xl px-3 text-xs font-bold transition ${active ? 'bg-white/12 text-white' : 'border border-white/8 bg-white/[.025] text-white/45 hover:text-white/70'}`}>{children}</button>
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`h-8 rounded-lg px-3 text-xs font-bold transition ${active ? 'bg-white/12 text-white' : 'text-white/42 hover:text-white/70'}`}>{children}</button>
}
