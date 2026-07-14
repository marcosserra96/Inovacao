import { useEffect, useState, type FormEvent } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'

type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type Question = Database['public']['Tables']['questions']['Row']
type SetItem = Database['public']['Tables']['question_set_items']['Row']

export function AdminSetsPage() {
  const notify = useToast()
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [newSetName, setNewSetName] = useState('')
  const [items, setItems] = useState<SetItem[]>([])
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [addQuestionId, setAddQuestionId] = useState('')

  async function loadSets() {
    const { data, error } = await supabase.from('question_sets').select('*').order('created_at', { ascending: false })
    if (error) notify(error.message, 'error')
    setSets(data ?? [])
    if (data && data.length > 0 && !selectedSetId) setSelectedSetId(data[0].id)
  }

  async function loadQuestions() {
    const { data } = await supabase.from('questions').select('*').eq('status', 'active').order('statement')
    setAllQuestions(data ?? [])
  }

  async function loadItems(setId: string) {
    const { data, error } = await supabase
      .from('question_set_items')
      .select('*')
      .eq('question_set_id', setId)
      .order('position')
    if (error) notify(error.message, 'error')
    setItems(data ?? [])
  }

  useEffect(() => {
    loadSets()
    loadQuestions()
  }, [])

  useEffect(() => {
    if (selectedSetId) loadItems(selectedSetId)
  }, [selectedSetId])

  async function handleCreateSet(e: FormEvent) {
    e.preventDefault()
    if (!newSetName.trim()) return
    const { data, error } = await supabase.from('question_sets').insert({ name: newSetName.trim() }).select('id').single()
    if (error || !data) {
      notify(error?.message ?? 'Erro ao criar conjunto', 'error')
      return
    }
    setNewSetName('')
    notify('Conjunto criado.')
    await loadSets()
    setSelectedSetId(data.id)
  }

  async function handleDeleteSet(id: string) {
    if (!confirm('Excluir este conjunto de perguntas?')) return
    const { error } = await supabase.from('question_sets').delete().eq('id', id)
    if (error) {
      notify('Não foi possível excluir: este conjunto está em uso por uma sessão ou partida.', 'error')
      return
    }
    notify('Conjunto excluído.')
    if (selectedSetId === id) setSelectedSetId(null)
    loadSets()
  }

  async function handleAddQuestion() {
    if (!selectedSetId || !addQuestionId) return
    const { error } = await supabase.from('question_set_items').insert({
      question_set_id: selectedSetId,
      question_id: addQuestionId,
      position: items.length,
    })
    if (error) {
      notify(error.message.includes('duplicate') ? 'Esta pergunta já está no conjunto.' : error.message, 'error')
      return
    }
    setAddQuestionId('')
    loadItems(selectedSetId)
  }

  async function handleRemoveItem(questionId: string) {
    if (!selectedSetId) return
    await supabase
      .from('question_set_items')
      .delete()
      .eq('question_set_id', selectedSetId)
      .eq('question_id', questionId)
    loadItems(selectedSetId)
  }

  async function handleReorder(index: number, direction: -1 | 1) {
    if (!selectedSetId) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return
    const a = items[index]
    const b = items[targetIndex]
    await Promise.all([
      supabase.from('question_set_items').update({ position: b.position }).eq('question_set_id', selectedSetId).eq('question_id', a.question_id),
      supabase.from('question_set_items').update({ position: a.position }).eq('question_set_id', selectedSetId).eq('question_id', b.question_id),
    ])
    loadItems(selectedSetId)
  }

  const questionById = (id: string) => allQuestions.find((q) => q.id === id)
  const availableQuestions = allQuestions.filter((q) => !items.some((i) => i.question_id === q.id))

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold mb-1">Conjuntos de perguntas</h1>
      <p className="text-ink-muted mb-6">Agrupe perguntas para usar em sessões individuais ou duelos.</p>

      <div className="grid grid-cols-[280px_1fr] gap-6 items-start">
        <Card className="p-0 overflow-hidden">
          <form className="p-4 border-b border-border flex gap-2" onSubmit={handleCreateSet}>
            <Input placeholder="Novo conjunto" value={newSetName} onChange={(e) => setNewSetName(e.target.value)} />
            <Button size="md" type="submit">
              +
            </Button>
          </form>
          <ul className="divide-y divide-border">
            {sets.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSetId(set.id)}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    selectedSetId === set.id ? 'bg-primary/10 text-primary font-medium' : 'text-ink hover:bg-ink/5'
                  }`}
                >
                  {set.name}
                </button>
              </li>
            ))}
            {sets.length === 0 && <li className="px-4 py-3 text-sm text-ink-muted">Nenhum conjunto ainda.</li>}
          </ul>
        </Card>

        {selectedSetId ? (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">{sets.find((s) => s.id === selectedSetId)?.name}</h2>
              <Button variant="ghost" size="md" className="text-danger" onClick={() => handleDeleteSet(selectedSetId)}>
                Excluir conjunto
              </Button>
            </div>

            <div className="flex gap-2 mb-4">
              <Select value={addQuestionId} onChange={(e) => setAddQuestionId(e.target.value)} className="flex-1">
                <option value="">Selecione uma pergunta para adicionar…</option>
                {availableQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.statement.slice(0, 80)}
                  </option>
                ))}
              </Select>
              <Button size="md" onClick={handleAddQuestion} disabled={!addQuestionId}>
                Adicionar
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhuma pergunta neste conjunto ainda.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {items.map((item, index) => {
                  const question = questionById(item.question_id)
                  return (
                    <li key={item.question_id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5">
                      <span className="text-xs text-ink-muted w-5">{index + 1}.</span>
                      <span className="flex-1 text-sm text-ink truncate">{question?.statement ?? '(pergunta removida)'}</span>
                      <button
                        type="button"
                        className="text-ink-muted hover:text-ink px-1 disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => handleReorder(index, -1)}
                        aria-label="Mover para cima"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-ink-muted hover:text-ink px-1 disabled:opacity-30"
                        disabled={index === items.length - 1}
                        onClick={() => handleReorder(index, 1)}
                        aria-label="Mover para baixo"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-ink-muted hover:text-danger px-1"
                        onClick={() => handleRemoveItem(item.question_id)}
                        aria-label="Remover do conjunto"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-ink-muted">Selecione ou crie um conjunto para gerenciar suas perguntas.</p>
          </Card>
        )}
      </div>
    </AdminShell>
  )
}
