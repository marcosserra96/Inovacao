import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Database } from '@/types/database.types'

type Question = Database['public']['Tables']['questions']['Row']
type Category = Database['public']['Tables']['categories']['Row']

/**
 * Lista de perguntas com checkbox, usada para montar o conteúdo de uma
 * etapa (quiz coletivo, duelo) direto na tela de criação — sem precisar
 * passar por "Conjuntos" antes. O conjunto de perguntas em si é criado por
 * baixo dos panos a partir da seleção (ver AdminLiveQuizConfigPage).
 */
export function QuestionPicker({
  questions,
  categories,
  selectedIds,
  onChange,
  emptyHint,
}: {
  questions: Question[]
  categories: Category[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  emptyHint?: string
}) {
  const [search, setSearch] = useState('')
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return questions
    return questions.filter((q) => q.statement.toLowerCase().includes(term))
  }, [questions, search])

  const selectedSet = new Set(selectedIds)

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }

  if (questions.length === 0) {
    return (
      <p className="text-sm text-ink-muted rounded-xl border border-dashed border-border p-4 text-center">
        {emptyHint ?? 'Nenhuma pergunta cadastrada ainda — cadastre em "Perguntas" antes de criar o quiz.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Buscar pergunta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <span className="text-xs text-ink-muted whitespace-nowrap">{selectedIds.length} selecionada{selectedIds.length === 1 ? '' : 's'}</span>
        <Button type="button" size="md" variant="ghost" onClick={() => onChange(filtered.map((q) => q.id))}>
          Marcar tudo
        </Button>
        <Button type="button" size="md" variant="ghost" onClick={() => onChange([])}>
          Limpar
        </Button>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
        {filtered.map((q) => (
          <label key={q.id} className="flex items-start gap-3 px-3.5 py-2.5 text-sm hover:bg-bg cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={selectedSet.has(q.id)}
              onChange={() => toggle(q.id)}
            />
            <span className="flex-1 min-w-0">
              <span className="block text-ink truncate">{q.statement}</span>
              {(q.category_id || q.difficulty) && (
                <span className="flex gap-1.5 mt-1">
                  {q.category_id && <Badge tone="neutral">{categoryName(q.category_id) ?? 'Categoria'}</Badge>}
                  <Badge tone="neutral">{q.difficulty}</Badge>
                </span>
              )}
            </span>
          </label>
        ))}
        {filtered.length === 0 && <p className="px-3.5 py-4 text-sm text-ink-muted text-center">Nenhuma pergunta encontrada.</p>}
      </div>
    </div>
  )
}
