import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']

interface ResultState {
  totalScore: number
  correctCount: number
  totalQuestions: number
  participantId?: string
  displayName?: string
}

export function IndividualResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const { theme } = useTheme()
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [rank, setRank] = useState<number | null>(null)

  const result = location.state as ResultState | null

  useEffect(() => {
    if (!sessionId) return
    supabase
      .from('individual_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data }) => setSession(data))
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || !result?.participantId) return
    supabase
      .from('v_individual_ranking')
      .select('rank')
      .eq('session_id', sessionId)
      .eq('participant_id', result.participantId)
      .maybeSingle()
      .then(({ data }) => setRank(data?.rank ?? null))
  }, [sessionId, result?.participantId])

  return (
    <PublicShell>
      <Card className="text-center">
        <p className="text-sm font-medium text-primary mb-1">Desafio concluído</p>
        <h1 className="font-display text-2xl font-bold mb-2">{theme.resultMessage}</h1>

        {result ? (
          <div className="grid grid-cols-2 gap-3 my-6">
            <div className="rounded-2xl bg-bg px-4 py-4">
              <p className="font-display text-3xl font-bold text-primary">{result.totalScore}</p>
              <p className="text-xs text-ink-muted mt-1">pontos</p>
            </div>
            <div className="rounded-2xl bg-bg px-4 py-4">
              <p className="font-display text-3xl font-bold text-primary">
                {result.correctCount}/{result.totalQuestions}
              </p>
              <p className="text-xs text-ink-muted mt-1">acertos</p>
            </div>
          </div>
        ) : (
          <p className="text-ink-muted my-6">Sua participação foi registrada com sucesso.</p>
        )}

        {rank && (
          <p className="text-ink-muted mb-4">
            Você está em <span className="font-bold text-ink">{rank}º lugar</span> no ranking geral.
          </p>
        )}

        {session?.show_ranking && (
          <Link to={`/ranking/${sessionId}`}>
            <Button size="lg" className="w-full">
              Ver ranking completo
            </Button>
          </Link>
        )}
      </Card>
    </PublicShell>
  )
}
