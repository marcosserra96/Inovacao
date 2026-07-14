import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database, GameMode, QuestionDifficulty, QuestionStatus, QuestionType } from '@/types/database.types'

type Question = Database['public']['Tables']['questions']['Row']
type QuestionOption = Database['public']['Tables']['question_options']['Row']
type Category = Database['public']['Tables']['categories']['Row']

// multiple_choice e poll ainda não têm submissão/pontuação implementadas
// (ver Fase 6 no plano) — omitidos da UI para não oferecer um fluxo quebrado.
const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'single_choice', label: 'Escolha única' },
  { value: 'true_false', label: 'Verdadeiro ou falso' },
  { value: 'image', label: 'Pergunta com imagem' },
  { value: 'tiebreaker', label: 'Pergunta de desempate' },
]

const DIFFICULTY_OPTIONS: { value: QuestionDifficulty; label: string }[] = [
  { value: 'easy', label: 'Fácil' },
  { value: 'medium', label: 'Médio' },
  { value: 'hard', label: 'Difícil' },
]

interface EditableOption {
  id: string | null
  text: string
  is_correct: boolean
}

function defaultOptions(type: QuestionType): EditableOption[] {
  if (type === 'true_false') {
    return [
      { id: null, text: 'Verdadeiro', is_correct: true },
      { id: null, text: 'Falso', is_correct: false },
    ]
  }
  return [
    { id: null, text: '', is_correct: true },
    { id: null, text: '', is_correct: false },
  ]
}

export function QuestionForm({
  question,
  categories,
  onSaved,
  onCancel,
}: {
  question: (Question & { question_options: QuestionOption[] }) | null
  categories: Category[]
  onSaved: () => void
  onCancel: () => void
}) {
  const notify = useToast()
  const [statement, setStatement] = useState(question?.statement ?? '')
  const [categoryId, setCategoryId] = useState(question?.category_id ?? '')
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(question?.difficulty ?? 'medium')
  const [type, setType] = useState<QuestionType>(question?.type ?? 'single_choice')
  const [timeLimit, setTimeLimit] = useState(question?.time_limit_seconds ?? 20)
  const [basePoints, setBasePoints] = useState(question?.base_points ?? 100)
  const [mediaUrl, setMediaUrl] = useState(question?.media_url ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [status, setStatus] = useState<QuestionStatus>(question?.status ?? 'active')
  const [tags, setTags] = useState((question?.tags ?? []).join(', '))
  const [modes, setModes] = useState<GameMode[]>(question?.modes ?? ['individual', 'duel'])
  const [options, setOptions] = useState<EditableOption[]>(
    question
      ? question.question_options
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((o) => ({ id: o.id, text: o.text, is_correct: o.is_correct }))
      : defaultOptions('single_choice'),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!question && type === 'true_false') {
      setOptions(defaultOptions('true_false'))
    }
  }, [type, question])

  function toggleMode(mode: GameMode) {
    setModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]))
  }

  function updateOption(index: number, patch: Partial<EditableOption>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  function setCorrectSingle(index: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === index })))
  }

  function addOption() {
    setOptions((prev) => [...prev, { id: null, text: '', is_correct: false }])
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!statement.trim()) {
      notify('Digite o enunciado da pergunta.', 'error')
      return
    }
    if (options.length < 2) {
      notify('Adicione pelo menos duas alternativas.', 'error')
      return
    }
    if (!options.some((o) => o.is_correct)) {
      notify('Marque a alternativa correta.', 'error')
      return
    }
    if (options.some((o) => !o.text.trim())) {
      notify('Preencha o texto de todas as alternativas.', 'error')
      return
    }

    setSaving(true)
    const payload = {
      statement: statement.trim(),
      category_id: categoryId || null,
      difficulty,
      type,
      time_limit_seconds: timeLimit,
      base_points: basePoints,
      media_url: mediaUrl.trim() || null,
      explanation: explanation.trim() || null,
      status,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      modes,
    }

    let questionId = question?.id ?? null
    if (questionId) {
      const { error } = await supabase.from('questions').update(payload).eq('id', questionId)
      if (error) {
        notify(error.message, 'error')
        setSaving(false)
        return
      }
    } else {
      const { data, error } = await supabase.from('questions').insert(payload).select('id').single()
      if (error || !data) {
        notify(error?.message ?? 'Erro ao criar pergunta', 'error')
        setSaving(false)
        return
      }
      questionId = data.id
    }

    const existingIds = question?.question_options.map((o) => o.id) ?? []
    const keptIds = options.filter((o) => o.id).map((o) => o.id as string)
    const removedIds = existingIds.filter((id) => !keptIds.includes(id))

    for (const [index, option] of options.entries()) {
      if (option.id) {
        const { error } = await supabase
          .from('question_options')
          .update({ text: option.text.trim(), is_correct: option.is_correct, position: index })
          .eq('id', option.id)
        if (error) {
          notify(`Erro ao salvar alternativa: ${error.message}`, 'error')
          setSaving(false)
          return
        }
      } else {
        const { error } = await supabase.from('question_options').insert({
          question_id: questionId,
          text: option.text.trim(),
          is_correct: option.is_correct,
          position: index,
        })
        if (error) {
          notify(`Erro ao criar alternativa: ${error.message}`, 'error')
          setSaving(false)
          return
        }
      }
    }

    if (removedIds.length > 0) {
      const { error } = await supabase.from('question_options').delete().in('id', removedIds)
      if (error) {
        notify(
          'Algumas alternativas removidas já foram respondidas em uma sessão e não podem ser excluídas. Elas foram mantidas.',
          'error',
        )
      }
    }

    setSaving(false)
    notify(question ? 'Pergunta atualizada.' : 'Pergunta criada.')
    onSaved()
  }

  const allowMultipleCorrect = false // reservado para multiple_choice (Fase 6)

  return (
    <div className="flex flex-col gap-4">
      <Field label="Enunciado" htmlFor="statement">
        <Textarea id="statement" rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Categoria" htmlFor="category">
          <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dificuldade" htmlFor="difficulty">
          <Select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}>
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Tipo" htmlFor="type">
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tempo limite (s)" htmlFor="timeLimit">
          <Input
            id="timeLimit"
            type="number"
            min={5}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
          />
        </Field>
        <Field label="Pontuação base" htmlFor="basePoints">
          <Input
            id="basePoints"
            type="number"
            min={0}
            value={basePoints}
            onChange={(e) => setBasePoints(Number(e.target.value))}
          />
        </Field>
      </div>

      {type === 'image' && (
        <Field label="URL da imagem" htmlFor="mediaUrl">
          <Input id="mediaUrl" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" />
        </Field>
      )}

      <div>
        <p className="text-sm font-medium text-ink mb-2">Alternativas</p>
        <div className="flex flex-col gap-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type={allowMultipleCorrect ? 'checkbox' : 'radio'}
                name="correct-option"
                checked={option.is_correct}
                onChange={() => setCorrectSingle(index)}
                aria-label={`Marcar alternativa ${index + 1} como correta`}
              />
              <Input
                className="flex-1"
                value={option.text}
                disabled={type === 'true_false'}
                onChange={(e) => updateOption(index, { text: e.target.value })}
                placeholder={`Alternativa ${index + 1}`}
              />
              {type !== 'true_false' && options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="text-ink-muted hover:text-danger px-2"
                  aria-label="Remover alternativa"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {type !== 'true_false' && (
          <Button variant="ghost" size="md" className="mt-2" onClick={addOption}>
            + Adicionar alternativa
          </Button>
        )}
      </div>

      <Field label="Explicação (mostrada após a revelação)" htmlFor="explanation">
        <Textarea id="explanation" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tags (separadas por vírgula)" htmlFor="tags">
          <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="inovação, produto" />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus)}>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
            <option value="archived">Arquivada</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="text-sm font-medium text-ink mb-2">Modos em que pode ser usada</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={modes.includes('individual')} onChange={() => toggleMode('individual')} />
            Desafio individual
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={modes.includes('duel')} onChange={() => toggleMode('duel')} />
            Duelo ao vivo
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar pergunta'}
        </Button>
      </div>
    </div>
  )
}
