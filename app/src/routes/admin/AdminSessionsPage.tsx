import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { IndividualSessionForm } from './IndividualSessionForm'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

const sessionStatusTone: Record<string, 'success' | 'neutral' | 'primary' | 'danger'> = {
  draft: 'neutral',
  scheduled: 'primary',
  open: 'success',
  closed: 'danger',
}

const sessionStatusLabel: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  open: 'Aberta',
  closed: 'Encerrada',
}

const matchStatusLabel: Record<string, string> = {
  draft: 'Rascunho',
  lobby: 'Lobby',
  in_progress: 'Em andamento',
  finished: 'Encerrada',
  cancelled: 'Cancelada',
}

export function AdminSessionsPage() {
  const notify = useToast()
  const [sessions, setSessions] = useState<IndividualSession[]>([])
  const [matches, setMatches] = useState<DuelMatch[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [scoringConfigs, setScoringConfigs] = useState<ScoringConfig[]>([])
  const [editing, setEditing] = useState<IndividualSession | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [s, m, qs, sc] = await Promise.all([
      supabase.from('individual_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('duel_matches').select('*').order('created_at', { ascending: false }),
      supabase.from('question_sets').select('*').order('name'),
      supabase.from('scoring_configs').select('*').order('created_at'),
    ])
    if (s.error) notify(s.error.message, 'error')
    setSessions(s.data ?? [])
    setMatches(m.data ?? [])
    setQuestionSets(qs.data ?? [])
    setScoringConfigs(sc.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta sessão? Os resultados associados também serão perdidos.')) return
    const { error } = await supabase.from('individual_sessions').delete().eq('id', id)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Sessão excluída.')
    load()
  }

  return (
    <AdminShell>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold mb-1">Sessões e partidas</h1>
          <p className="text-ink-muted">Desafios individuais e duelos ao vivo.</p>
        </div>
        <Button onClick={() => setEditing(null)} disabled={questionSets.length === 0 || scoringConfigs.length === 0}>
          Nova sessão individual
        </Button>
      </div>

      <h2 className="font-display text-lg font-bold mb-3">Desafio individual</h2>
      <Card className="p-0 overflow-hidden mb-8">
        {loading ? (
          <p className="p-6 text-ink-muted text-sm">Carregando…</p>
        ) : sessions.length === 0 ? (
          <p className="p-6 text-ink-muted text-sm">Nenhuma sessão criada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">{s.name}</p>
                  <p className="text-xs text-ink-muted">
                    Código: <span className="font-mono">{s.code}</span> · {s.question_count} perguntas
                  </p>
                </div>
                <Badge tone={sessionStatusTone[s.status]}>{sessionStatusLabel[s.status]}</Badge>
                <Link to={`/admin/resultados/${s.id}`}>
                  <Button size="md" variant="ghost">
                    Resultados
                  </Button>
                </Link>
                <Link to={`/ranking/${s.id}`} target="_blank">
                  <Button size="md" variant="ghost">
                    Ranking público
                  </Button>
                </Link>
                <Button size="md" variant="ghost" onClick={() => setEditing(s)}>
                  Editar
                </Button>
                <Button size="md" variant="ghost" className="text-danger" onClick={() => handleDelete(s.id)}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="font-display text-lg font-bold mb-3">Duelos ao vivo</h2>
      <p className="text-sm text-ink-muted mb-3">
        Duelos são criados pelo <Link to="/apresentador/nova" className="text-primary underline">painel do apresentador</Link>.
      </p>
      <Card className="p-0 overflow-hidden">
        {matches.length === 0 ? (
          <p className="p-6 text-ink-muted text-sm">Nenhum duelo realizado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {matches.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-medium truncate">{m.name ?? 'Duelo sem nome'}</p>
                  <p className="text-xs text-ink-muted">
                    Código: <span className="font-mono">{m.code}</span> · {m.rounds_total} rodadas
                  </p>
                </div>
                <Badge tone={m.status === 'finished' ? 'success' : m.status === 'in_progress' ? 'primary' : 'neutral'}>
                  {matchStatusLabel[m.status]}
                </Badge>
                <Link to={`/apresentador/${m.id}`}>
                  <Button size="md" variant="ghost">
                    Abrir
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Editar sessão' : 'Nova sessão individual'} wide>
        {editing !== undefined && (
          <IndividualSessionForm
            session={editing}
            questionSets={questionSets}
            scoringConfigs={scoringConfigs}
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
