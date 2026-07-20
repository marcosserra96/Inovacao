import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database, IndividualSessionStatus, QuestionOrderMode } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function IndividualSessionForm({
  session,
  questionSets,
  scoringConfigs,
  onSaved,
  onCancel,
}: {
  session: IndividualSession | null
  questionSets: QuestionSet[]
  scoringConfigs: ScoringConfig[]
  onSaved: (saved: IndividualSession) => void
  onCancel: () => void
}) {
  const notify = useToast()
  const [name, setName] = useState(session?.name ?? '')
  const [questionSetId, setQuestionSetId] = useState(session?.question_set_id ?? questionSets[0]?.id ?? '')
  const [scoringConfigId, setScoringConfigId] = useState(
    session?.scoring_config_id ?? scoringConfigs.find((c) => c.is_default)?.id ?? scoringConfigs[0]?.id ?? '',
  )
  const [opensAt, setOpensAt] = useState(toLocalInputValue(session?.opens_at ?? null))
  const [closesAt, setClosesAt] = useState(toLocalInputValue(session?.closes_at ?? null))
  const [questionCount, setQuestionCount] = useState(session?.question_count ?? 10)
  const [questionOrder, setQuestionOrder] = useState<QuestionOrderMode>(session?.question_order ?? 'random')
  const [shuffleOptions, setShuffleOptions] = useState(session?.shuffle_options ?? true)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<string>(
    session?.time_limit_seconds != null ? String(session.time_limit_seconds) : '',
  )
  const [allowRetry, setAllowRetry] = useState(session?.allow_retry ?? false)
  const [requireIdentification, setRequireIdentification] = useState(session?.require_identification ?? true)
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(session?.show_correct_answer ?? true)
  const [showRanking, setShowRanking] = useState(session?.show_ranking ?? true)
  const [rankingSize, setRankingSize] = useState(session?.ranking_size ?? 10)
  // Sessão nova já nasce aberta — é o caminho comum (criar e já deixar as
  // pessoas entrarem). Quem quiser agendar com antecedência muda para
  // "Agendada"/"Rascunho" manualmente.
  const [status, setStatus] = useState<IndividualSessionStatus>(session?.status ?? 'open')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !questionSetId || !scoringConfigId) {
      notify('Preencha nome, conjunto de perguntas e fórmula de pontuação.', 'error')
      return
    }
    setSaving(true)
    const payload = {
      name: name.trim(),
      question_set_id: questionSetId,
      scoring_config_id: scoringConfigId,
      opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      question_count: questionCount,
      question_order: questionOrder,
      shuffle_options: shuffleOptions,
      time_limit_seconds: timeLimitSeconds ? Number(timeLimitSeconds) : null,
      allow_retry: allowRetry,
      require_identification: requireIdentification,
      show_correct_answer: showCorrectAnswer,
      show_ranking: showRanking,
      ranking_size: rankingSize,
      status,
    }

    const { data, error } = session
      ? await supabase.from('individual_sessions').update(payload).eq('id', session.id).select().single()
      : await supabase.from('individual_sessions').insert(payload).select().single()

    setSaving(false)
    if (error || !data) {
      notify(error?.message ?? 'Erro ao salvar sessão', 'error')
      return
    }
    notify(session ? 'Sessão atualizada.' : 'Sessão criada.')
    onSaved(data)
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome da sessão" htmlFor="sessName">
        <Input id="sessName" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Conjunto de perguntas" htmlFor="sessSet">
          <Select id="sessSet" value={questionSetId} onChange={(e) => setQuestionSetId(e.target.value)}>
            {questionSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fórmula de pontuação" htmlFor="sessScoring">
          <Select id="sessScoring" value={scoringConfigId} onChange={(e) => setScoringConfigId(e.target.value)}>
            {scoringConfigs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Abertura" htmlFor="opensAt">
          <Input id="opensAt" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
        </Field>
        <Field label="Encerramento" htmlFor="closesAt">
          <Input id="closesAt" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Quantidade de perguntas" htmlFor="qCount">
          <Input
            id="qCount"
            type="number"
            min={1}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          />
        </Field>
        <Field label="Ordem das perguntas" htmlFor="qOrder">
          <Select id="qOrder" value={questionOrder} onChange={(e) => setQuestionOrder(e.target.value as QuestionOrderMode)}>
            <option value="random">Aleatória</option>
            <option value="fixed">Fixa (ordem do conjunto)</option>
          </Select>
        </Field>
        <Field label="Tempo por pergunta (s)" htmlFor="timeLimit" hint="Vazio = usa o tempo de cada pergunta">
          <Input
            id="timeLimit"
            type="number"
            min={5}
            value={timeLimitSeconds}
            onChange={(e) => setTimeLimitSeconds(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
        <Switch checked={shuffleOptions} onChange={setShuffleOptions} label="Embaralhar alternativas" />
        <Switch checked={allowRetry} onChange={setAllowRetry} label="Permitir repetir participação" />
        <Switch checked={requireIdentification} onChange={setRequireIdentification} label="Exigir identificação" />
        <Switch checked={showCorrectAnswer} onChange={setShowCorrectAnswer} label="Mostrar resposta correta" />
        <Switch checked={showRanking} onChange={setShowRanking} label="Mostrar ranking" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Pessoas exibidas no ranking" htmlFor="rankingSize">
          <Input
            id="rankingSize"
            type="number"
            min={1}
            value={rankingSize}
            onChange={(e) => setRankingSize(Number(e.target.value))}
          />
        </Field>
        <Field label="Status" htmlFor="sessStatus">
          <Select id="sessStatus" value={status} onChange={(e) => setStatus(e.target.value as IndividualSessionStatus)}>
            <option value="draft">Rascunho</option>
            <option value="scheduled">Agendada</option>
            <option value="open">Aberta</option>
            <option value="closed">Encerrada</option>
          </Select>
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar sessão'}
        </Button>
      </div>
    </div>
  )
}
