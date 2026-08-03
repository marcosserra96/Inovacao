import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database, DuelWinCondition } from '@/types/database.types'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

export function LiveQuizSessionForm({
  questionSets,
  scoringConfigs,
  onSaved,
  onCancel,
}: {
  questionSets: QuestionSet[]
  scoringConfigs: ScoringConfig[]
  onSaved: (saved: LiveQuizSession) => void
  onCancel: () => void
}) {
  const notify = useToast()
  const [name, setName] = useState('')
  const [questionSetId, setQuestionSetId] = useState(questionSets[0]?.id ?? '')
  const [scoringConfigId, setScoringConfigId] = useState(scoringConfigs.find((c) => c.is_default)?.id ?? scoringConfigs[0]?.id ?? '')
  const [questionsTotal, setQuestionsTotal] = useState(10)
  const [showRankingAfterQuestion, setShowRankingAfterQuestion] = useState(true)
  const [hideStatementOnPhone, setHideStatementOnPhone] = useState(false)
  const [isRehearsal, setIsRehearsal] = useState(false)
  const [finalistsCount, setFinalistsCount] = useState(4)
  const [duelRoundsTotal, setDuelRoundsTotal] = useState(5)
  const [duelWinCondition, setDuelWinCondition] = useState<DuelWinCondition>('score')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !questionSetId || !scoringConfigId) {
      notify('Preencha nome, conjunto de perguntas e fórmula de pontuação.', 'error')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('live_quiz_sessions')
      .insert({
        name: name.trim(),
        question_set_id: questionSetId,
        scoring_config_id: scoringConfigId,
        questions_total: questionsTotal,
        show_ranking_after_question: showRankingAfterQuestion,
        hide_statement_on_phone: hideStatementOnPhone,
        is_rehearsal: isRehearsal,
        finalists_count: finalistsCount,
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Conjunto de perguntas" htmlFor="lqSet">
          <Select id="lqSet" value={questionSetId} onChange={(e) => setQuestionSetId(e.target.value)}>
            {questionSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
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
      </div>

      <Field label="Quantidade de perguntas" htmlFor="lqCount">
        <Input
          id="lqCount"
          type="number"
          min={1}
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Formato" htmlFor="lqFinalistsCount" hint="Com 4, roda 2 semifinais e depois a final entre os vencedores.">
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
        <Field label="Número de rodadas por duelo" htmlFor="lqDuelRounds" className="mt-4">
          <Input id="lqDuelRounds" type="number" min={1} value={duelRoundsTotal} onChange={(e) => setDuelRoundsTotal(Number(e.target.value))} />
        </Field>
        <p className="text-xs text-ink-muted mt-2">O duelo usa o mesmo conjunto de perguntas do quiz coletivo, por padrão.</p>
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
