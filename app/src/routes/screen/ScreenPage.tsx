import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import clsx from 'clsx'
import { StageShell } from '@/components/layout/StageShell'
import { QrCode } from '@/components/ui/QrCode'
import { RetryableError } from '@/components/ui/RetryableError'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useDuelTimer } from '@/hooks/useDuelTimer'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type DuelPlayer = Database['public']['Tables']['duel_players']['Row']
type DuelRound = Database['public']['Tables']['duel_rounds']['Row']
type AnswerFlag = Database['public']['Tables']['duel_answer_flags']['Row']

export function ScreenPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const { theme } = useTheme()
  const { row: match, error: matchError, retry: retryMatch } = useRealtimeRow<DuelMatch>('duel_matches', matchId)
  const { rows: players } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', matchId)
  const { rows: rounds } = useRealtimeList<DuelRound>('duel_rounds', 'match_id', matchId)
  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === match?.current_round_number && !r.voided) ?? null,
    [rounds, match?.current_round_number],
  )
  const { rows: flags } = useRealtimeList<AnswerFlag>('duel_answer_flags', 'round_id', currentRound?.id)
  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const remainingMs = useDuelTimer(currentRound)

  const disputants = players.filter((p) => p.is_active_disputant)
  const [p1, p2] = disputants

  useEffect(() => {
    if (!currentRound) {
      setQuestion(null)
      return
    }
    supabase
      .rpc('get_public_duel_round_question', { p_round_id: currentRound.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [currentRound?.id, currentRound?.revealed_at])

  const joinUrl = match ? `${window.location.origin}/duelo/entrar/${match.code}` : ''

  if (matchError) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center">
          <RetryableError message={matchError} onRetry={retryMatch} tone="dark" />
        </div>
      </StageShell>
    )
  }

  if (!match) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-2xl opacity-70">Carregando partida…</p>
        </div>
      </StageShell>
    )
  }

  if (match.phase === 'waiting_players' || match.status === 'lobby' || match.status === 'draft') {
    return (
      <StageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <p className="font-display text-lg uppercase tracking-[0.3em] opacity-70">{theme.eventName}</p>
          <h1 className="font-display text-5xl font-bold">{match.name ?? theme.dynamicName}</h1>
          <QrCode value={joinUrl} size={220} />
          <p className="text-2xl">
            Entre com o código <span className="font-display font-bold tracking-widest">{match.code}</span>
          </p>
          <div className="flex gap-6 mt-4">
            {players.map((p) => (
              <span key={p.id} className="rounded-full px-5 py-2 text-lg font-medium" style={{ backgroundColor: p.avatar_color }}>
                {p.display_name}
              </span>
            ))}
          </div>
        </div>
      </StageShell>
    )
  }

  if (match.status === 'finished') {
    const winner = players.find((p) => p.id === match.winner_player_id)
    return (
      <StageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="font-display text-2xl uppercase tracking-[0.3em] opacity-70">Fim de jogo</p>
          <h1 className="font-display text-6xl font-bold">{winner ? `${winner.display_name} venceu! 🏆` : 'Empate!'}</h1>
          <div className="flex gap-16 mt-6">
            {disputants.map((p) => (
              <div key={p.id} className="text-center">
                <p className="text-xl opacity-70">{p.display_name}</p>
                <p className="font-display text-5xl font-bold">{p.total_score}</p>
              </div>
            ))}
          </div>
        </div>
      </StageShell>
    )
  }

  return (
    <StageShell>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg uppercase tracking-[0.2em] opacity-70">{match.name ?? theme.dynamicName}</p>
        <p className="font-display text-lg opacity-70">Rodada {match.current_round_number} de {match.rounds_total}</p>
      </div>

      <div className="flex items-center justify-between mt-6 mb-8">
        {[p1, p2].map((p, i) =>
          p ? (
            <div key={p.id} className={clsx('flex items-center gap-4', i === 1 && 'flex-row-reverse text-right')}>
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full font-display text-2xl font-bold"
                style={{ backgroundColor: p.avatar_color }}
              >
                {p.display_name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="text-xl font-medium">{p.display_name}</p>
                <p className="font-display text-4xl font-bold">{p.total_score}</p>
                {flags.some((f) => f.player_id === p.id && f.answered) && (
                  <Badge>respondeu ✓</Badge>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="opacity-40 text-xl">
              aguardando…
            </div>
          ),
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {question ? (
          <>
            {currentRound?.timer_started_at && (
              <p className="font-display text-6xl font-bold mb-6">{Math.ceil(remainingMs / 1000)}</p>
            )}
            <h2 className="font-display text-4xl font-bold max-w-4xl leading-snug mb-10">{question.statement}</h2>
            <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
              {question.options.map((option) => {
                const revealed = Boolean(currentRound?.revealed_at)
                return (
                  <div
                    key={option.optionId}
                    className={clsx(
                      'rounded-2xl border-2 px-6 py-5 text-xl font-medium',
                      revealed && option.isCorrect ? 'border-success bg-success/20' : 'border-white/20 bg-white/5',
                    )}
                  >
                    {option.text}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="font-display text-3xl opacity-70">Preparando a próxima pergunta…</p>
        )}
      </div>

      {match.screen_message && <p className="text-center text-lg opacity-80 mt-4">{match.screen_message}</p>}
    </StageShell>
  )
}

function Badge({ children }: { children: string }) {
  return <span className="inline-block mt-1 rounded-full bg-success/20 px-3 py-0.5 text-sm text-success">{children}</span>
}
