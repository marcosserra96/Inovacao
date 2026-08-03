import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']

const statusLabel: Record<string, string> = {
  draft: 'Rascunho',
  lobby: 'Aguardando participantes',
  in_progress: 'Em andamento',
  finished: 'Encerrada',
  cancelled: 'Cancelada',
  open: 'Aberta',
  scheduled: 'Agendada',
  closed: 'Encerrada',
}

/**
 * Limpeza de dados de teste/ensaio antes do evento real — cada bloco lista
 * um tipo de conteúdo com seleção múltipla e exclusão em lote. Ações
 * destrutivas, sempre com confirmação explícita antes de executar.
 */
export function AdminMaintenancePage() {
  const notify = useToast()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [liveQuizzes, setLiveQuizzes] = useState<LiveQuizSession[]>([])
  const [matches, setMatches] = useState<DuelMatch[]>([])
  const [sessions, setSessions] = useState<IndividualSession[]>([])
  const [sets, setSets] = useState<QuestionSet[]>([])
  const [usedSetIds, setUsedSetIds] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    const [{ data: lq }, { data: m }, { data: s }, { data: qs }] = await Promise.all([
      supabase.from('live_quiz_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('duel_matches').select('*').order('created_at', { ascending: false }),
      supabase.from('individual_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('question_sets').select('*').order('name'),
    ])
    setLiveQuizzes(lq ?? [])
    setMatches(m ?? [])
    setSessions(s ?? [])
    setSets(qs ?? [])

    const used = new Set<string>()
    for (const q of lq ?? []) {
      if (q.question_set_id) used.add(q.question_set_id)
      if (q.duel_question_set_id) used.add(q.duel_question_set_id)
    }
    for (const mm of m ?? []) used.add(mm.question_set_id)
    for (const ss of s ?? []) used.add(ss.question_set_id)
    setUsedSetIds(used)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function bulkDelete(table: 'live_quiz_sessions' | 'duel_matches' | 'individual_sessions' | 'question_sets', ids: string[]) {
    if (ids.length === 0) return
    setBusy(true)
    const { error } = await supabase.from(table).delete().in('id', ids)
    setBusy(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify(`${ids.length} registro${ids.length === 1 ? '' : 's'} excluído${ids.length === 1 ? '' : 's'}.`)
    load()
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
      <h1 className="font-display text-2xl font-extrabold mb-1 text-primary-dark">Manutenção</h1>
      <p className="text-ink-muted mb-6">
        Limpe dados de teste ou ensaio antes do evento real. Excluir aqui é definitivo — confirme com atenção.
      </p>

      <div className="flex flex-col gap-6 max-w-3xl">
        <MaintenanceSection
          title="Quiz coletivos"
          emptyLabel="Nenhum quiz coletivo criado ainda."
          items={liveQuizzes.map((q) => ({
            id: q.id,
            title: q.name,
            subtitle: `Código ${q.code}`,
            status: statusLabel[q.status] ?? q.status,
            tone: q.status === 'in_progress' ? 'success' : q.status === 'finished' ? 'neutral' : 'primary',
          }))}
          busy={busy}
          onDelete={(ids) => bulkDelete('live_quiz_sessions', ids)}
        />

        <MaintenanceSection
          title="Duelos avulsos"
          emptyLabel="Nenhum duelo criado ainda."
          items={matches.map((m) => ({
            id: m.id,
            title: m.name ?? 'Duelo sem nome',
            subtitle: `Código ${m.code}`,
            status: statusLabel[m.status] ?? m.status,
            tone: m.status === 'in_progress' ? 'success' : m.status === 'finished' ? 'neutral' : 'primary',
          }))}
          busy={busy}
          onDelete={(ids) => bulkDelete('duel_matches', ids)}
        />

        <MaintenanceSection
          title="Sessões individuais"
          emptyLabel="Nenhuma sessão individual criada ainda."
          items={sessions.map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: `Código ${s.code}`,
            status: statusLabel[s.status] ?? s.status,
            tone: s.status === 'open' ? 'success' : s.status === 'closed' ? 'neutral' : 'primary',
          }))}
          busy={busy}
          onDelete={(ids) => bulkDelete('individual_sessions', ids)}
        />

        <MaintenanceSection
          title="Conjuntos de perguntas"
          emptyLabel="Nenhum conjunto criado ainda."
          items={sets.map((s) => ({
            id: s.id,
            title: s.name,
            subtitle: usedSetIds.has(s.id) ? 'Em uso por alguma sessão/partida' : 'Não usado em nada no momento',
            status: usedSetIds.has(s.id) ? 'Em uso' : 'Livre',
            tone: usedSetIds.has(s.id) ? 'neutral' : 'success',
          }))}
          busy={busy}
          onDelete={(ids) => bulkDelete('question_sets', ids)}
          deleteHint="Conjuntos em uso não podem ser excluídos — exclua a sessão/partida que os usa primeiro."
        />
      </div>
    </AdminShell>
  )
}

function MaintenanceSection({
  title,
  emptyLabel,
  items,
  busy,
  onDelete,
  deleteHint,
}: {
  title: string
  emptyLabel: string
  items: { id: string; title: string; subtitle: string; status: string; tone: 'success' | 'neutral' | 'primary' }[]
  busy: boolean
  onDelete: (ids: string[]) => void
  deleteHint?: string
}) {
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => items.some((i) => i.id === id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleDeleteClick() {
    if (selected.length === 0) return
    if (!confirm(`Excluir ${selected.length} registro${selected.length === 1 ? '' : 's'} de "${title}"? Essa ação não pode ser desfeita.`)) return
    onDelete(selected)
    setSelected([])
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <span className="text-xs text-ink-muted">{items.length} no total</span>
      </div>
      {deleteHint && <p className="text-xs text-ink-muted mb-3">{deleteHint}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-ink-muted mt-3">{emptyLabel}</p>
      ) : (
        <>
          <div className="flex items-center justify-between mt-3 mb-2">
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-primary underline" onClick={() => setSelected(items.map((i) => i.id))}>
                Marcar tudo
              </button>
              <button type="button" className="text-ink-muted underline" onClick={() => setSelected([])}>
                Limpar seleção
              </button>
            </div>
            <Button size="md" variant="danger" disabled={busy || selected.length === 0} onClick={handleDeleteClick}>
              Excluir selecionados ({selected.length})
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {items.map((item) => (
              <label key={item.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-bg cursor-pointer">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                <span className="flex-1 min-w-0">
                  <span className="block text-ink truncate">{item.title}</span>
                  <span className="block text-xs text-ink-muted truncate">{item.subtitle}</span>
                </span>
                <Badge tone={item.tone}>{item.status}</Badge>
              </label>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
