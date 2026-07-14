import { useEffect, useState, type FormEvent } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'

type Category = Database['public']['Tables']['categories']['Row']

export function AdminCategoriesPage() {
  const notify = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) notify(error.message, 'error')
    setCategories(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const { error } = await supabase.from('categories').insert({ name: newName.trim() })
    if (error) {
      notify(error.message, 'error')
      return
    }
    setNewName('')
    notify('Categoria criada.')
    load()
  }

  async function handleUpdate(id: string) {
    if (!editingName.trim()) return
    const { error } = await supabase.from('categories').update({ name: editingName.trim() }).eq('id', id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    setEditingId(null)
    notify('Categoria atualizada.')
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta categoria? Perguntas vinculadas ficarão sem categoria.')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Categoria excluída.')
    load()
  }

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold mb-1">Categorias</h1>
      <p className="text-ink-muted mb-6">Organize as perguntas por tema.</p>

      <Card className="mb-6">
        <form className="flex gap-3" onSubmit={handleCreate}>
          <Input
            placeholder="Nome da nova categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" size="md">
            Adicionar
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-ink-muted text-sm">Carregando…</p>
        ) : categories.length === 0 ? (
          <p className="p-6 text-ink-muted text-sm">Nenhuma categoria cadastrada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((cat) => (
              <li key={cat.id} className="flex items-center gap-3 px-5 py-3.5">
                {editingId === cat.id ? (
                  <>
                    <Input
                      className="flex-1"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                    <Button size="md" onClick={() => handleUpdate(cat.id)}>
                      Salvar
                    </Button>
                    <Button size="md" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-ink">{cat.name}</span>
                    <Button
                      size="md"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(cat.id)
                        setEditingName(cat.name)
                      }}
                    >
                      Editar
                    </Button>
                    <Button size="md" variant="ghost" className="text-danger" onClick={() => handleDelete(cat.id)}>
                      Excluir
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminShell>
  )
}
