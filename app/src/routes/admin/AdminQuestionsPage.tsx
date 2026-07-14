import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { QuestionForm } from './QuestionForm'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { downloadCsv, parseCsv } from '@/lib/csv'
import type { Database } from '@/types/database.types'

type Question = Database['public']['Tables']['questions']['Row']
type QuestionOption = Database['public']['Tables']['question_options']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type QuestionWithOptions = Question & { question_options: QuestionOption[] }

const difficultyLabel: Record<string, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }
const statusTone: Record<string, 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  archived: 'danger',
}

export function AdminQuestionsPage() {
  const notify = useToast()
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<QuestionWithOptions | null | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const [{ data: qs, error: qErr }, { data: cats, error: cErr }] = await Promise.all([
      supabase.from('questions').select('*, question_options(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ])
    if (qErr) notify(qErr.message, 'error')
    if (cErr) notify(cErr.message, 'error')
    setQuestions((qs as QuestionWithOptions[]) ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (search && !q.statement.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter && q.category_id !== categoryFilter) return false
      if (statusFilter && q.status !== statusFilter) return false
      return true
    })
  }, [questions, search, categoryFilter, statusFilter])

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'

  async function handleDuplicate(q: QuestionWithOptions) {
    const { data, error } = await supabase
      .from('questions')
      .insert({
        statement: `${q.statement} (cópia)`,
        category_id: q.category_id,
        difficulty: q.difficulty,
        type: q.type,
        time_limit_seconds: q.time_limit_seconds,
        base_points: q.base_points,
        media_url: q.media_url,
        explanation: q.explanation,
        status: 'inactive',
        modes: q.modes,
        tags: q.tags,
      })
      .select('id')
      .single()
    if (error || !data) {
      notify(error?.message ?? 'Erro ao duplicar', 'error')
      return
    }
    const newOptions = q.question_options.map((o) => ({
      question_id: data.id,
      text: o.text,
      is_correct: o.is_correct,
      position: o.position,
    }))
    const { error: optError } = await supabase.from('question_options').insert(newOptions)
    if (optError) {
      notify(optError.message, 'error')
      return
    }
    notify('Pergunta duplicada como inativa.')
    load()
  }

  async function handleToggleArchive(q: QuestionWithOptions) {
    const nextStatus = q.status === 'archived' ? 'active' : 'archived'
    const { error } = await supabase.from('questions').update({ status: nextStatus }).eq('id', q.id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(nextStatus === 'archived' ? 'Pergunta arquivada.' : 'Pergunta reativada.')
    load()
  }

  async function handleDelete(q: QuestionWithOptions) {
    if (!confirm('Excluir esta pergunta definitivamente? Essa ação não pode ser desfeita.')) return
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    if (error) {
      notify(
        'Não foi possível excluir: esta pergunta já foi usada em uma sessão. Arquive-a em vez de excluir.',
        'error',
      )
      return
    }
    notify('Pergunta excluída.')
    load()
  }

  function handleExport() {
    const header = [
      'statement', 'category', 'difficulty', 'type', 'time_limit_seconds', 'base_points',
      'explanation', 'media_url', 'tags', 'modes',
      'option_1', 'correct_1', 'option_2', 'correct_2', 'option_3', 'correct_3', 'option_4', 'correct_4',
    ]
    const rows = filtered.map((q) => {
      const opts = q.question_options.slice().sort((a, b) => a.position - b.position)
      const optCells: string[] = []
      for (let i = 0; i < 4; i++) {
        optCells.push(opts[i]?.text ?? '', opts[i] ? String(opts[i].is_correct) : '')
      }
      return [
        q.statement,
        categoryName(q.category_id),
        q.difficulty,
        q.type,
        String(q.time_limit_seconds),
        String(q.base_points),
        q.explanation ?? '',
        q.media_url ?? '',
        q.tags.join(';'),
        q.modes.join(';'),
        ...optCells,
      ]
    })
    downloadCsv('perguntas.csv', [header, ...rows])
  }

  async function handleImportFile(file: File) {
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length < 2) {
      notify('Arquivo CSV vazio.', 'error')
      return
    }
    const [, ...dataRows] = rows
    let imported = 0
    for (const row of dataRows) {
      const [
        statement, categoryName, difficulty, type, timeLimit, basePoints,
        explanation, mediaUrl, tags, modes,
        opt1, correct1, opt2, correct2, opt3, correct3, opt4, correct4,
      ] = row
      if (!statement?.trim()) continue

      let categoryId: string | null = null
      if (categoryName?.trim()) {
        const existing = categories.find((c) => c.name.toLowerCase() === categoryName.trim().toLowerCase())
        if (existing) {
          categoryId = existing.id
        } else {
          const { data } = await supabase.from('categories').insert({ name: categoryName.trim() }).select('id').single()
          if (data) {
            categoryId = data.id
            setCategories((prev) => [...prev, { id: data.id, name: categoryName.trim(), created_at: new Date().toISOString() }])
          }
        }
      }

      const { data: inserted, error } = await supabase
        .from('questions')
        .insert({
          statement: statement.trim(),
          category_id: categoryId,
          difficulty: (difficulty?.trim() || 'medium') as Question['difficulty'],
          type: (type?.trim() || 'single_choice') as Question['type'],
          time_limit_seconds: Number(timeLimit) || 20,
          base_points: Number(basePoints) || 100,
          explanation: explanation?.trim() || null,
          media_url: mediaUrl?.trim() || null,
          tags: tags ? tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
          modes: modes ? (modes.split(';').filter(Boolean) as Question['modes']) : ['individual', 'duel'],
          status: 'active',
        })
        .select('id')
        .single()

      if (error || !inserted) continue

      const optionPairs = [
        [opt1, correct1], [opt2, correct2], [opt3, correct3], [opt4, correct4],
      ].filter(([text]) => text?.trim())

      await supabase.from('question_options').insert(
        optionPairs.map(([text, correct], index) => ({
          question_id: inserted.id,
          text: text.trim(),
          is_correct: correct?.trim().toLowerCase() === 'true',
          position: index,
        })),
      )
      imported++
    }
    notify(`${imported} pergunta(s) importada(s) como ativas — revise antes do evento.`)
    load()
  }

  return (
    <AdminShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold mb-1">Perguntas</h1>
          <p className="text-ink-muted">Banco de perguntas usado pelos dois modos de jogo.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
              e.target.value = ''
            }}
          />
          <Button variant="ghost" size="md" onClick={() => fileInputRef.current?.click()}>
            Importar CSV
          </Button>
          <Button variant="ghost" size="md" onClick={handleExport}>
            Exportar CSV
          </Button>
          <Button size="md" onClick={() => setEditing(null)}>
            Nova pergunta
          </Button>
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por texto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="max-w-xs">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-xs">
          <option value="">Todos os status</option>
          <option value="active">Ativa</option>
          <option value="inactive">Inativa</option>
          <option value="archived">Arquivada</option>
        </Select>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-ink-muted text-sm">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-ink-muted text-sm">Nenhuma pergunta encontrada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((q) => (
              <li key={q.id} className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-ink truncate">{q.statement}</p>
                  <div className="flex gap-2 mt-1.5 items-center flex-wrap">
                    <Badge tone="neutral">{categoryName(q.category_id)}</Badge>
                    <Badge tone="primary">{difficultyLabel[q.difficulty]}</Badge>
                    <Badge tone={statusTone[q.status]}>{q.status === 'active' ? 'Ativa' : q.status === 'inactive' ? 'Inativa' : 'Arquivada'}</Badge>
                    {q.is_demo && <Badge tone="accent">Exemplo</Badge>}
                  </div>
                </div>
                <Button size="md" variant="ghost" onClick={() => setEditing(q)}>
                  Editar
                </Button>
                <Button size="md" variant="ghost" onClick={() => handleDuplicate(q)}>
                  Duplicar
                </Button>
                <Button size="md" variant="ghost" onClick={() => handleToggleArchive(q)}>
                  {q.status === 'archived' ? 'Reativar' : 'Arquivar'}
                </Button>
                <Button size="md" variant="ghost" className="text-danger" onClick={() => handleDelete(q)}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Editar pergunta' : 'Nova pergunta'} wide>
        {editing !== undefined && (
          <QuestionForm
            question={editing}
            categories={categories}
            onCancel={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined)
              load()
            }}
          />
        )}
      </Modal>
    </AdminShell>
  )
}
