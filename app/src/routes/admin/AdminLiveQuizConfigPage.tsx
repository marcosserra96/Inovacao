import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { Spinner } from '@/components/ui/Spinner'
import { QuestionPicker } from '@/components/admin/QuestionPicker'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database, DuelWinCondition } from '@/types/database.types'

type LiveQuizDefaults = Database['public']['Tables']['live_quiz_defaults']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']
type Question = Database['public']['Tables']['questions']['Row']
type Category = Database['public']['Tables']['categories']['Row']

/**
 * Configuração da dinâmica — as perguntas de cada etapa (e o resto do
 * formato) são definidas aqui UMA VEZ e ficam salvas. "Iniciar dinâmica"
 * (Controle da dinâmica) só lê essa configuração e já começa, sem
 * formulário no meio — editar aqui é só pra quando precisar trocar algo.
 */
export function AdminLiveQuizConfigPage() {
  const notify = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [defaults, setDefaults] = useState<LiveQuizDefaults | null>(null)
  const [scoringConfigs, setScoringConfigs] = useState<ScoringConfig[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [scoringConfigId, setScoringConfigId] = useState('')
  const [quizQuestionIds, setQuizQuestionIds] = useState<string[]>([])
  const [questionsTotal, setQuestionsTotal] = useState(10)
  const [showRankingAfterQuestion, setShowRankingAfterQuestion] = useState(true)
  const [hideStatementOnPhone, setHideStatementOnPhone] = useState(false)
  const [finalistsCount, setFinalistsCount] = useState(4)
  const [sameQuestionsForDuel, setSameQuestionsForDuel] = useState(true)
  const [duelQuestionIds, setDuelQuestionIds] = useState<string[]>([])
  const [duelWinCondition, setDuelWinCondition] = useState<DuelWinCondition>('score')
  const [rulesText, setRulesText] = useState('')
  const [sameQuestionsForFinal, setSameQuestionsForFinal] = useState(true)
  const [finalQuestionIds, setFinalQuestionIds] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: def }, { data: sc }, { data: qs }, { data: cats }] = await Promise.all([
        supabase.from('live_quiz_defaults').select('*').eq('id', true).maybeSingle(),
        supabase.from('scoring_configs').select('*').order('created_at'),
        supabase.from('questions').select('*').eq('status', 'active').order('statement'),
        supabase.from('categories').select('*').order('name'),
      ])
      setScoringConfigs(sc ?? [])
      setQuestions(qs ?? [])
      setCategories(cats ?? [])

      if (def) {
        setDefaults(def)
        setScoringConfigId(def.scoring_config_id ?? sc?.find((c) => c.is_default)?.id ?? sc?.[0]?.id ?? '')
        setQuestionsTotal(def.questions_total)
        setShowRankingAfterQuestion(def.show_ranking_after_question)
        setHideStatementOnPhone(def.hide_statement_on_phone)
        setFinalistsCount(def.finalists_count)
        setSameQuestionsForDuel(def.duel_question_set_id === null || def.duel_question_set_id === def.question_set_id)
        setDuelWinCondition(def.duel_win_condition)
        setRulesText(def.rules_text)
        setSameQuestionsForFinal(def.final_question_set_id === null || def.final_question_set_id === def.duel_question_set_id)

        const [{ data: quizItems }, { data: duelItems }, { data: finalItems }] = await Promise.all([
          def.question_set_id
            ? supabase.from('question_set_items').select('question_id').eq('question_set_id', def.question_set_id)
            : Promise.resolve({ data: [] as { question_id: string }[] }),
          def.duel_question_set_id && def.duel_question_set_id !== def.question_set_id
            ? supabase.from('question_set_items').select('question_id').eq('question_set_id', def.duel_question_set_id)
            : Promise.resolve({ data: [] as { question_id: string }[] }),
          def.final_question_set_id && def.final_question_set_id !== def.duel_question_set_id
            ? supabase.from('question_set_items').select('question_id').eq('question_set_id', def.final_question_set_id)
            : Promise.resolve({ data: [] as { question_id: string }[] }),
        ])
        setQuizQuestionIds((quizItems ?? []).map((i) => i.question_id))
        setDuelQuestionIds((duelItems ?? []).map((i) => i.question_id))
        setFinalQuestionIds((finalItems ?? []).map((i) => i.question_id))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function replaceQuestionSetItems(setId: string, questionIds: string[]): Promise<boolean> {
    const { error: delError } = await supabase.from('question_set_items').delete().eq('question_set_id', setId)
    if (delError) {
      notify(delError.message, 'error')
      return false
    }
    if (questionIds.length === 0) return true
    const { error: insError } = await supabase
      .from('question_set_items')
      .insert(questionIds.map((question_id, position) => ({ question_set_id: setId, question_id, position })))
    if (insError) {
      notify(insError.message, 'error')
      return false
    }
    return true
  }

  async function saveSelection(existingSetId: string | null, setName: string, questionIds: string[]): Promise<string | null> {
    if (existingSetId) {
      const ok = await replaceQuestionSetItems(existingSetId, questionIds)
      return ok ? existingSetId : null
    }
    const { data: set, error } = await supabase.from('question_sets').insert({ name: setName }).select('id').single()
    if (error || !set) {
      notify(error?.message ?? 'Erro ao salvar as perguntas', 'error')
      return null
    }
    const ok = await replaceQuestionSetItems(set.id, questionIds)
    return ok ? set.id : null
  }

  async function handleSave() {
    if (!scoringConfigId) {
      notify('Selecione a fórmula de pontuação.', 'error')
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
    if (finalistsCount === 4 && !sameQuestionsForFinal && finalQuestionIds.length === 0) {
      notify('Selecione ao menos uma pergunta para a final, ou marque "usar as mesmas do duelo".', 'error')
      return
    }

    setSaving(true)

    const quizSetId = await saveSelection(defaults?.question_set_id ?? null, 'Dinâmica — Quiz coletivo', quizQuestionIds)
    if (!quizSetId) {
      setSaving(false)
      return
    }

    let duelSetId: string | null = null
    if (!sameQuestionsForDuel) {
      const existingDuelSetId = defaults?.duel_question_set_id && defaults.duel_question_set_id !== defaults.question_set_id ? defaults.duel_question_set_id : null
      duelSetId = await saveSelection(existingDuelSetId, 'Dinâmica — Duelo', duelQuestionIds)
      if (!duelSetId) {
        setSaving(false)
        return
      }
    }

    let finalSetId: string | null = null
    if (finalistsCount === 4 && !sameQuestionsForFinal) {
      const existingFinalSetId = defaults?.final_question_set_id && defaults.final_question_set_id !== defaults.duel_question_set_id ? defaults.final_question_set_id : null
      finalSetId = await saveSelection(existingFinalSetId, 'Dinâmica — Final', finalQuestionIds)
      if (!finalSetId) {
        setSaving(false)
        return
      }
    }

    // Sempre usa TODAS as perguntas marcadas em cada etapa — nunca um
    // número de rodadas configurado à parte que pudesse deixar perguntas
    // marcadas de fora sem querer.
    const duelRoundsTotal = sameQuestionsForDuel ? quizQuestionIds.length : duelQuestionIds.length
    const finalRoundsTotal = finalistsCount === 4 ? (sameQuestionsForFinal ? duelRoundsTotal : finalQuestionIds.length) : null

    const { data, error } = await supabase
      .from('live_quiz_defaults')
      .update({
        question_set_id: quizSetId,
        scoring_config_id: scoringConfigId,
        questions_total: Math.min(questionsTotal, quizQuestionIds.length),
        show_ranking_after_question: showRankingAfterQuestion,
        hide_statement_on_phone: hideStatementOnPhone,
        finalists_count: finalistsCount,
        duel_question_set_id: duelSetId,
        duel_rounds_total: duelRoundsTotal,
        duel_win_condition: duelWinCondition,
        rules_text: rulesText,
        final_question_set_id: finalSetId,
        final_rounds_total: finalRoundsTotal,
      })
      .eq('id', true)
      .select()
      .single()

    setSaving(false)
    if (error || !data) {
      notify(error?.message ?? 'Erro ao salvar configuração', 'error')
      return
    }
    setDefaults(data)
    notify('Configuração salva — já vale pra próxima vez que iniciar a dinâmica.')
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="flex justify-center text-primary py-10">
          <Spinner />
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-extrabold mb-1 text-primary-dark">Configurar perguntas da dinâmica</h1>
      <p className="text-ink-muted mb-6">
        Configure uma vez — "Iniciar dinâmica" (Controle da dinâmica) usa isto direto, sem pedir de novo. Só volte
        aqui se precisar trocar alguma coisa.
      </p>

      <Card className="max-w-3xl flex flex-col gap-4">
        <Field label="Fórmula de pontuação" htmlFor="scoring">
          <Select id="scoring" value={scoringConfigId} onChange={(e) => setScoringConfigId(e.target.value)}>
            {scoringConfigs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Regras exibidas no telão" htmlFor="rules" hint='Uma regra por linha. Use "{finalistas}" para o número de finalistas configurado abaixo.'>
          <Textarea id="rules" rows={4} value={rulesText} onChange={(e) => setRulesText(e.target.value)} />
        </Field>

        <div>
          <p className="text-sm font-medium text-ink mb-1.5">Etapa 1 — Perguntas do quiz coletivo</p>
          <QuestionPicker questions={questions} categories={categories} selectedIds={quizQuestionIds} onChange={setQuizQuestionIds} />
        </div>

        <Field label="Quantas dessas entram em cada partida" htmlFor="count" hint="Sorteadas aleatoriamente entre as marcadas acima.">
          <Input
            id="count"
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
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-sm font-semibold text-ink mb-1">Etapa 2 — Duelo final</p>
          <p className="text-xs text-ink-muted mb-3">Todas as perguntas marcadas abaixo entram — sem sorteio, sem número de rodadas para configurar à parte.</p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <Field label="Formato" htmlFor="finalistsCount" hint="Com 4, sorteia 2 duplas para as semifinais e a final é entre os vencedores.">
              <Select id="finalistsCount" value={finalistsCount} onChange={(e) => setFinalistsCount(Number(e.target.value))}>
                <option value={4}>4 finalistas (semifinais + final)</option>
                <option value={2}>2 finalistas (duelo único)</option>
              </Select>
            </Field>
            <Field label="Critério de vitória" htmlFor="duelWin">
              <Select id="duelWin" value={duelWinCondition} onChange={(e) => setDuelWinCondition(e.target.value as DuelWinCondition)}>
                <option value="score">Pontuação</option>
                <option value="correct_count">Quantidade de acertos</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Switch
              checked={sameQuestionsForDuel}
              onChange={(checked) => {
                setSameQuestionsForDuel(checked)
                if (!checked && duelQuestionIds.length === 0) setDuelQuestionIds(quizQuestionIds)
              }}
              label="Usar as mesmas perguntas do quiz coletivo no duelo"
            />
          </div>
          <div className="mt-3">
            <p className="text-sm font-medium text-ink mb-1.5">Perguntas do duelo (etapa 2)</p>
            {sameQuestionsForDuel ? (
              <p className="text-sm text-ink-muted rounded-xl border border-dashed border-border p-4 text-center">
                Usando as {quizQuestionIds.length} perguntas da etapa 1 (todas) — desmarque a opção acima para escolher outras.
              </p>
            ) : (
              <>
                <QuestionPicker questions={questions} categories={categories} selectedIds={duelQuestionIds} onChange={setDuelQuestionIds} />
                <p className="text-xs text-ink-muted mt-1.5">{duelQuestionIds.length} rodada{duelQuestionIds.length === 1 ? '' : 's'} por duelo.</p>
              </>
            )}
          </div>
        </div>

        {finalistsCount === 4 && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm font-semibold text-ink mb-1">Etapa 3 — Final</p>
            <p className="text-xs text-ink-muted mb-3">
              As duas semifinais já respondem às mesmas perguntas ao mesmo tempo. Aqui você define as perguntas da
              final — separadas das semifinais, para não repetir.
            </p>
            <Switch
              checked={sameQuestionsForFinal}
              onChange={(checked) => {
                setSameQuestionsForFinal(checked)
                if (!checked && finalQuestionIds.length === 0) setFinalQuestionIds(sameQuestionsForDuel ? quizQuestionIds : duelQuestionIds)
              }}
              label="Usar as mesmas perguntas do duelo (etapa 2) na final"
            />
            <div className="mt-3">
              <p className="text-sm font-medium text-ink mb-1.5">Perguntas da final (etapa 3)</p>
              {sameQuestionsForFinal ? (
                <p className="text-sm text-ink-muted rounded-xl border border-dashed border-border p-4 text-center">
                  Usando as mesmas {sameQuestionsForDuel ? quizQuestionIds.length : duelQuestionIds.length} perguntas da etapa 2 (todas) —
                  desmarque a opção acima para escolher outras.
                </p>
              ) : (
                <>
                  <QuestionPicker questions={questions} categories={categories} selectedIds={finalQuestionIds} onChange={setFinalQuestionIds} />
                  <p className="text-xs text-ink-muted mt-1.5">{finalQuestionIds.length} rodada{finalQuestionIds.length === 1 ? '' : 's'} na final.</p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar configuração'}
          </Button>
        </div>
      </Card>
    </AdminShell>
  )
}
