import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { downloadCsv } from '@/lib/csv'
import type { Database } from '@/types/database.types'

type Ranking = Database['public']['Views']['v_individual_ranking']['Row']
type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type QuestionStats = Database['public']['Views']['v_question_stats']['Row']

export function AdminResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const notify = useToast()
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [ranking, setRanking] = useState<Ranking[]>([])
  const [stats, setStats] = useState<QuestionStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    const sid = sessionId
    async function load() {
      setLoading(true)
      const { data: sess, error: sessErr } = await supabase
        .from('individual_sessions')
        .select('*')
        .eq('id', sid)
        .single()
      if (sessErr) notify(sessErr.message, 'error')
      setSession(sess)

      const { data: rank, error: rankErr } = await supabase
        .from('v_individual_ranking')
        .select('*')
        .eq('session_id', sid)
        .order('rank')
      if (rankErr) notify(rankErr.message, 'error')
      setRanking(rank ?? [])

      if (sess) {
        const { data: items } = await supabase
          .from('question_set_items')
          .select('question_id')
          .eq('question_set_id', sess.question_set_id)
        const questionIds = (items ?? []).map((i) => i.question_id)
        if (questionIds.length > 0) {
          const { data: qStats } = await supabase.from('v_question_stats').select('*').in('question_id', questionIds)
          setStats(qStats ?? [])
        }
      }
      setLoading(false)
    }
    load()
  }, [sessionId])

  function exportRankingCsv() {
    const header = ['posição', 'nome', 'equipe', 'pontuação', 'acertos', 'tempo total (ms)', 'concluído em']
    const rows = ranking.map((r) => [
      String(r.rank),
      r.display_name,
      r.team ?? '',
      String(r.total_score),
      String(r.correct_count),
      String(r.total_time_ms),
      r.finished_at,
    ])
    downloadCsv(`ranking-${session?.name ?? sessionId}.csv`, [header, ...rows])
  }

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold mb-1">Resultados {session ? `— ${session.name}` : ''}</h1>
      <p className="text-ink-muted mb-6">Ranking e desempenho por pergunta.</p>

      {loading ? (
        <p className="text-ink-muted text-sm">Carregando…</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-bold">Ranking ({ranking.length} participantes)</h2>
            <Button variant="ghost" size="md" onClick={exportRankingCsv} disabled={ranking.length === 0}>
              Exportar CSV
            </Button>
          </div>
          <Card className="p-0 overflow-hidden mb-8">
            {ranking.length === 0 ? (
              <p className="p-6 text-ink-muted text-sm">Ainda não há participações concluídas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted border-b border-border">
                    <th className="px-5 py-2.5 font-medium">#</th>
                    <th className="px-5 py-2.5 font-medium">Nome</th>
                    <th className="px-5 py-2.5 font-medium">Equipe</th>
                    <th className="px-5 py-2.5 font-medium text-right">Pontos</th>
                    <th className="px-5 py-2.5 font-medium text-right">Acertos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ranking.map((r) => (
                    <tr key={r.participant_id}>
                      <td className="px-5 py-2.5">{r.rank}</td>
                      <td className="px-5 py-2.5">{r.display_name}</td>
                      <td className="px-5 py-2.5 text-ink-muted">{r.team ?? '—'}</td>
                      <td className="px-5 py-2.5 text-right font-medium">{r.total_score}</td>
                      <td className="px-5 py-2.5 text-right">{r.correct_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <h2 className="font-display text-lg font-bold mb-3">Desempenho por pergunta</h2>
          <Card className="p-0 overflow-hidden">
            {stats.length === 0 ? (
              <p className="p-6 text-ink-muted text-sm">Sem respostas registradas ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted border-b border-border">
                    <th className="px-5 py-2.5 font-medium">Pergunta</th>
                    <th className="px-5 py-2.5 font-medium text-right">Respostas</th>
                    <th className="px-5 py-2.5 font-medium text-right">% de acerto</th>
                    <th className="px-5 py-2.5 font-medium text-right">Tempo médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.map((s) => (
                    <tr key={s.question_id}>
                      <td className="px-5 py-2.5 max-w-xs truncate">{s.statement}</td>
                      <td className="px-5 py-2.5 text-right">{s.times_answered}</td>
                      <td className="px-5 py-2.5 text-right">{s.correct_rate_pct ?? '—'}%</td>
                      <td className="px-5 py-2.5 text-right">
                        {s.avg_time_ms ? `${(s.avg_time_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </AdminShell>
  )
}
