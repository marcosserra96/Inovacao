import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'

type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

export function PresenterNewMatchPage() {
  const notify = useToast()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [scoringConfigs, setScoringConfigs] = useState<ScoringConfig[]>([])
  const [questionSetId, setQuestionSetId] = useState('')
  const [scoringConfigId, setScoringConfigId] = useState('')
  const [roundsTotal, setRoundsTotal] = useState(5)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: qs }, { data: sc }] = await Promise.all([
        supabase.from('question_sets').select('*').order('name'),
        supabase.from('scoring_configs').select('*').order('created_at'),
      ])
      setQuestionSets(qs ?? [])
      setScoringConfigs(sc ?? [])
      if (qs && qs.length > 0) setQuestionSetId(qs[0].id)
      const defaultConfig = sc?.find((c) => c.is_default) ?? sc?.[0]
      if (defaultConfig) setScoringConfigId(defaultConfig.id)
    }
    load()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!questionSetId || !scoringConfigId) {
      notify('Selecione um conjunto de perguntas e uma fórmula de pontuação.', 'error')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('create_duel_match', {
      p_name: name.trim() || null,
      p_question_set_id: questionSetId,
      p_scoring_config_id: scoringConfigId,
      p_rounds_total: roundsTotal,
    })
    setSubmitting(false)
    if (error || !data) {
      notify(error?.message ?? 'Erro ao criar partida', 'error')
      return
    }
    const result = data as unknown as { matchId: string; code: string }
    navigate(`/apresentador/${result.matchId}`)
  }

  return (
    <PublicShell>
      <Card>
        <h1 className="font-display text-2xl font-bold mb-1">Nova partida de duelo</h1>
        <p className="text-ink-muted text-sm mb-6">Configure a partida antes de gerar o código de acesso.</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label="Nome da partida (opcional)" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Duelo Final" />
          </Field>
          <Field label="Conjunto de perguntas" htmlFor="questionSet">
            <Select id="questionSet" value={questionSetId} onChange={(e) => setQuestionSetId(e.target.value)}>
              {questionSets.length === 0 && <option value="">Nenhum conjunto disponível</option>}
              {questionSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fórmula de pontuação" htmlFor="scoringConfig">
            <Select id="scoringConfig" value={scoringConfigId} onChange={(e) => setScoringConfigId(e.target.value)}>
              {scoringConfigs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Número de rodadas" htmlFor="rounds">
            <Input
              id="rounds"
              type="number"
              min={1}
              value={roundsTotal}
              onChange={(e) => setRoundsTotal(Number(e.target.value))}
            />
          </Field>
          <Button type="submit" size="xl" disabled={submitting || questionSets.length === 0} className="mt-2">
            {submitting ? 'Criando…' : 'Criar partida'}
          </Button>
        </form>
      </Card>
    </PublicShell>
  )
}
