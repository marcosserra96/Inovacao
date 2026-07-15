import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { QrCode } from '@/components/ui/QrCode'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type Ranking = Database['public']['Views']['v_individual_ranking']['Row']

const medalByRank: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }
const topRowStyle: Record<number, string> = {
  1: 'bg-gradient-to-r from-accent/15 to-accent/5 border-2 border-accent/30',
  2: 'bg-gradient-to-r from-primary/12 to-primary/5 border-2 border-primary/25',
  3: 'bg-gradient-to-r from-secondary/12 to-secondary/5 border-2 border-secondary/25',
}

export function RankingPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session: adminSession } = useAuth()
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

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <PublicShell>
      {/* Só aparece para quem está logado no admin/apresentador — participantes
          nunca veem isso. Evita ficar "preso" nesta tela ao abrir pelo painel. */}
      {adminSession && (
        <Link to="/admin/jogo" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          ← Voltar ao painel
        </Link>
      )}

      <Card>
        <h1 className="font-display text-2xl font-extrabold mb-1 text-primary-dark">{session?.name ?? 'Ranking'}</h1>
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
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300 ${topRowStyle[r.rank] ?? 'bg-bg'}`}
              >
                <span className="flex w-9 shrink-0 items-center justify-center font-display text-lg font-extrabold text-ink-muted">
                  {medalByRank[r.rank] ?? r.rank}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white">
                  {r.display_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">{r.display_name}</p>
                  {r.team && <p className="text-xs text-ink-muted">{r.team}</p>}
                </div>
                <span className="font-display text-lg font-extrabold text-primary">{r.total_score}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Fica projetada junto com o ranking — quem ainda não entrou pode
          escanear a qualquer momento. */}
      <Card className="mt-4 text-center">
        <p className="text-sm font-semibold text-ink-muted mb-3">Ainda não participou?</p>
        <QrCode value={siteUrl} size={140} />
        <p className="text-xs text-ink-muted mt-3">Escaneie para entrar</p>
      </Card>
    </PublicShell>
  )
}
