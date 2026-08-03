import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { QuestionPicker } from '@/components/admin/QuestionPicker'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database, DuelWinCondition } from '@/types/database.types'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']
type Question = Database['public']['Tables']['questions']['Row']
type Category = Database['public']['Tables']['categories']['Row']

/**
 * Cria um quiz coletivo escolhendo as perguntas direto aqui (marcando
 * caixinhas), em vez de exigir que um "conjunto de perguntas" já exista —
 * os conjuntos usados por baixo dos panos são criados automaticamente a
 * partir da seleção. "Conjuntos" continua existindo em Admin para quem
 * quiser reaproveitar o mesmo grupo em várias sessões.
 */
export function LiveQuizSessionForm({
  scoringConfigs,
  onSaved,
  onCancel,
}: {
  scoringConfigs: ScoringConfig[]
  onSaved: (saved: LiveQuizSession) => void
  onCancel: () => void
}) {
  const notify = useToast()
  const [questions, setQuestions] = useState<Question[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(true)

  const [name, setName] = useState('')
  const [scoringConfigId, setScoringConfigId] = useState(scoringConfigs.find((c) => c.is_default)?.id ?? scoringConfigs[0]?.id ?? '')
  const [quizQuestionIds, setQuizQuestionIds] = useState<string[]>([])
  const [questionsTotal, setQuestionsTotal] = useState(10)
  const [showRankingAfterQuestion, setShowRankingAfterQuestion] = useState(true)
  const [hideStatementOnPhone, setHideStatementOnPhone] = useState(false)
  const [isRehearsal, setIsRehearsal] = useState(false)
  const [finalistsCount, setFinalistsCount] = useState(4)
  const [sameQuestionsForDuel, setSameQuestionsForDuel] = useState(true)
  const [duelQuestionIds, setDuelQuestionIds] = useState<string[]>([])
  const [duelRoundsTotal, setDuelRoundsTotal] = useState(5)
  const [duelWinCondition, setDuelWinCondition] = useState<DuelWinCondition>('score')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: qs }, { data: cats }] = await Promise.all([
        supabase.from('questions').select('*').eq('status', 'active').order('statement'),
        supabase.from('categories').select('*').order('name'),
      ])
      setQuestions(qs ?? [])
      setCategories(cats ?? [])
      setLoadingQuestions(false)
    }
    load()
  }, [])

  // Quantidade de perguntas por rodada nunca deveria passar do que foi
  // selecionado — acompanha a seleção em vez de deixar configurar um
  // número que a sessão nunca vai conseguir atingir.
  useEffect(() => {
    setQuestionsTotal((prev) => (quizQuestionIds.length > 0 ? Math.min(prev || quizQuestionIds.length, quizQuestionIds.length) : prev))
  }, [quizQuestionIds.length])

  async function createQuestionSet(setName: string, questionIds: string[]): Promise<string | null> {
    const { data: set, error: setError } = await supabase.from('question_sets').insert({ name: setName }).select('id').single()
    if (setError || !set) {
      notify(setError?.message ?? 'Erro ao criar o conjunto de perguntas', 'error')
      return null
    }
    const { error: itemsError } = await supabase
      .from('question_set_items')
      .insert(questionIds.map((question_id, position) => ({ question_set_id: set.id, question_id, position })))
    if (itemsError) {
      notify(itemsError.message, 'error')
      return null
    }
    return set.id
  }

  async function handleSubmit() {
    if (!name.trim() || !scoringConfigId) {
      notify('Preencha o nome e a fórmula de pontuação.', 'error')
      return
    }
    if (quizQuestionIds.length === 0) {
      notify('Selecione ao menos uma pergunta para o quiz coletivo.', 'error')
      return
    }
    if (!sameQuestionsForDuel && duelQuestionIds.length === 0) {
      notify('Selecione ao menos uma pergunta para o duelo, ou marque "usar as mesmas do quiz".', 'error')
      return
    }

    setSaving(true)

    const quizSetId = await createQuestionSet(`${name.trim()} — Quiz`, quizQuestionIds)
    if (!quizSetId) {
      setSaving(false)
      return
    }

    let duelSetId: string | null = null
    if (!sameQuestionsForDuel) {
      duelSetId = await createQuestionSet(`${name.trim()} — Duelo`, duelQuestionIds)
      if (!duelSetId) {
        setSaving(false)
        return
      }
    }

    const { data, error } = await supabase
      .from('live_quiz_sessions')
      .insert({
        name: name.trim(),
        question_set_id: quizSetId,
        scoring_config_id: scoringConfigId,
        questions_total: Math.min(questionsTotal, quizQuestionIds.length),
        show_ranking_after_question: showRankingAfterQuestion,
        hide_statement_on_phone: hideStatementOnPhone,
        is_rehearsal: isRehearsal,
        finalists_count: finalistsCount,
        duel_question_set_id: duelSetId,
        duel_rounds_total: duelRoundsTotal,
        duel_win_condition: duelWinCondition,
      })
      .select()
      .single()

    setSaving(false)
    if (error || !data) {
      notify(error?.message ?? 'Erro ao criar o quiz', 'error')
      return
    }
    notify('Quiz coletivo criado.')
    onSaved(data)
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome do quiz" htmlFor="lqName">
        <Input id="lqName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Desafio Inovação EMR" />
      </Field>

      <Field label="Fórmula de pontuação" htmlFor="lqScoring">
        <Select id="lqScoring" value={scoringConfigId} onChange={(e) => setScoringConfigId(e.target.value)}>
          {scoringConfigs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <p className="text-sm font-medium text-ink mb-1.5">Etapa 1 — Perguntas do quiz coletivo</p>
        {loadingQuestions ? (
          <p className="text-sm text-ink-muted">Carregando perguntas…</p>
        ) : (
          <QuestionPicker questions={questions} categories={categories} selectedIds={quizQuestionIds} onChange={setQuizQuestionIds} />
        )}
      </div>

      <Field label="Quantas dessas entram em cada partida" htmlFor="lqCount" hint="Sorteadas aleatoriamente entre as marcadas acima.">
        <Input
          id="lqCount"
          type="number"
          min={1}
          max={quizQuestionIds.length || undefined}
          value={questionsTotal}
          onChange={(e) => setQuestionsTotal(Number(e.target.value))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
        <Switch checked={showRankingAfterQuestion} onChange={setShowRankingAfterQuestion} label="Mostrar ranking entre perguntas" />
        <Switch checked={hideStatementOnPhone} onChange={setHideStatementOnPhone} label="Ocultar enunciado no celular" />
        <Switch checked={isRehearsal} onChange={setIsRehearsal} label="Modo de ensaio" />
      </div>

      <div className="pt-2 border-t border-border">
        <p className="text-sm font-semibold text-ink mb-3">Etapa 2 — Duelo final</p>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <Field label="Formato" htmlFor="lqFinalistsCount" hint="Com 4, sorteia 2 duplas para as semifinais e a final é entre os vencedores.">
            <Select id="lqFinalistsCount" value={finalistsCount} onChange={(e) => setFinalistsCount(Number(e.target.value))}>
              <option value={4}>4 finalistas (semifinais + final)</option>
              <option value={2}>2 finalistas (duelo único)</option>
            </Select>
          </Field>
          <Field label="Critério de vitória" htmlFor="lqDuelWin">
            <Select id="lqDuelWin" value={duelWinCondition} onChange={(e) => setDuelWinCondition(e.target.value as DuelWinCondition)}>
              <option value="score">Pontuação</option>
              <option value="correct_count">Quantidade de acertos</option>
            </Select>
          </Field>
        </div>
        <Field label="Número de rodadas por duelo" htmlFor="lqDuelRounds">
          <Input id="lqDuelRounds" type="number" min={1} value={duelRoundsTotal} onChange={(e) => setDuelRoundsTotal(Number(e.target.value))} />
        </Field>

        <div className="mt-3">
          <Switch checked={sameQuestionsForDuel} onChange={setSameQuestionsForDuel} label="Usar as mesmas perguntas do quiz coletivo no duelo" />
        </div>
        {!sameQuestionsForDuel && (
          <div className="mt-3">
            <p className="text-sm font-medium text-ink mb-1.5">Perguntas específicas do duelo</p>
            <QuestionPicker questions={questions} categories={categories} selectedIds={duelQuestionIds} onChange={setDuelQuestionIds} />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Criando…' : 'Criar quiz coletivo'}
        </Button>
      </div>
    </div>
  )
}
