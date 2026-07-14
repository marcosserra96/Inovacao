import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type Ranking = Database['public']['Views']['v_individual_ranking']['Row']

const medalByRank: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function RankingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [ranking, setRanking] = useState<Ranking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    async function loadSession() {
      const { data } = await supabase.from('individual_sessions').select('*').eq('id', sessionId!).maybeSingle()
      if (!cancelled) setSession(data)
    }

    async function loadRanking() {
      const { data } = await supabase
        .from('v_individual_ranking')
        .select('*')
        .eq('session_id', sessionId!)
        .order('rank')
        .limit(session?.ranking_size ?? 10)
      if (!cancelled) {
        setRanking(data ?? [])
        setLoading(false)
      }
    }

    loadSession()
    loadRanking()
    const interval = setInterval(loadRanking, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.ranking_size])

  return (
    <PublicShell>
      <Card>
        <h1 className="font-display text-2xl font-bold mb-1">{session?.name ?? 'Ranking'}</h1>
        <p className="text-ink-muted text-sm mb-6">Atualizado automaticamente.</p>

        {session && !session.show_ranking ? (
          <p className="text-ink-muted text-sm">O ranking desta sessão não está disponível publicamente.</p>
        ) : loading ? (
          <div className="flex justify-center text-primary py-6">
            <Spinner />
          </div>
        ) : ranking.length === 0 ? (
          <p className="text-ink-muted text-sm">Ainda não há participações concluídas.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranking.map((r) => (
              <li
                key={r.participant_id}
                className="flex items-center gap-3 rounded-2xl bg-bg px-4 py-3 transition-all duration-300"
              >
                <span className="w-8 text-center font-display font-bold text-ink-muted">
                  {medalByRank[r.rank] ?? r.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink truncate">{r.display_name}</p>
                  {r.team && <p className="text-xs text-ink-muted">{r.team}</p>}
                </div>
                <span className="font-display font-bold text-primary">{r.total_score}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </PublicShell>
  )
}
