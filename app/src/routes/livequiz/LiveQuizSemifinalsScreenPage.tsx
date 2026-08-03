import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import clsx from 'clsx'
import { StageShell } from '@/components/layout/StageShell'
import { RetryableError } from '@/components/ui/RetryableError'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useDuelTimer } from '@/hooks/useDuelTimer'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type DuelPlayer = Database['public']['Tables']['duel_players']['Row']
type DuelRound = Database['public']['Tables']['duel_rounds']['Row']
type AnswerFlag = Database['public']['Tables']['duel_answer_flags']['Row']

/**
 * Telão único das semifinais: as duas duplas veem a MESMA pergunta, ao
 * mesmo tempo (coordenado pelas RPCs *_paired_duel_*) — em vez de dois
 * telões separados e fora de sincronia.
 */
export function LiveQuizSemifinalsScreenPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { row: session, error: sessionError, retry: retrySession } = useRealtimeRow<LiveQuizSession>('live_quiz_sessions', sessionId)
  const { row: match1 } = useRealtimeRow<DuelMatch>('duel_matches', session?.semifinal1_match_id ?? undefined)
  const { row: match2 } = useRealtimeRow<DuelMatch>('duel_matches', session?.semifinal2_match_id ?? undefined)
  const { rows: players1 } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', session?.semifinal1_match_id ?? undefined)
  const { rows: players2 } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', session?.semifinal2_match_id ?? undefined)
  const { rows: rounds1 } = useRealtimeList<DuelRound>('duel_rounds', 'match_id', session?.semifinal1_match_id ?? undefined)
  const { rows: rounds2 } = useRealtimeList<DuelRound>('duel_rounds', 'match_id', session?.semifinal2_match_id ?? undefined)

  const round1 = useMemo(
    () => rounds1.find((r) => r.round_number === match1?.current_round_number && !r.voided) ?? null,
    [rounds1, match1?.current_round_number],
  )
  const round2 = useMemo(
    () => rounds2.find((r) => r.round_number === match2?.current_round_number && !r.voided) ?? null,
    [rounds2, match2?.current_round_number],
  )
  const { rows: flags1 } = useRealtimeList<AnswerFlag>('duel_answer_flags', 'round_id', round1?.id)
  const { rows: flags2 } = useRealtimeList<AnswerFlag>('duel_answer_flags', 'round_id', round2?.id)

  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const remainingMs = useDuelTimer(round1)

  useEffect(() => {
    if (!round1) {
      setQuestion(null)
      return
    }
    supabase
      .rpc('get_public_duel_round_question', { p_round_id: round1.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [round1?.id, round1?.revealed_at])

  if (sessionError) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center">
          <RetryableError message={sessionError} onRetry={retrySession} tone="dark" />
        </div>
      </StageShell>
    )
  }

  if (!session || !match1 || !match2) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-2xl opacity-70">Carregando semifinais…</p>
        </div>
      </StageShell>
    )
  }

  if (match1.status === 'finished' && match2.status === 'finished') {
    const winner1 = players1.find((p) => p.id === match1.winner_player_id)
    const winner2 = players2.find((p) => p.id === match2.winner_player_id)
    return (
      <StageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <p className="font-display text-2xl uppercase tracking-[0.3em] opacity-70">Semifinais encerradas</p>
          <div className="flex gap-20">
            <div>
              <p className="text-lg opacity-70 mb-1">Semifinal 1</p>
              <p className="font-display text-4xl font-bold">{winner1 ? `${winner1.display_name} 🏆` : 'Empate'}</p>
            </div>
            <div>
              <p className="text-lg opacity-70 mb-1">Semifinal 2</p>
              <p className="font-display text-4xl font-bold">{winner2 ? `${winner2.display_name} 🏆` : 'Empate'}</p>
            </div>
          </div>
          <p className="text-xl opacity-70 mt-4">A final já vai começar…</p>
        </div>
      </StageShell>
    )
  }

  return (
    <StageShell>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg uppercase tracking-[0.2em] opacity-70">{session.name}</p>
        <p className="font-display text-lg opacity-70">
          Semifinais — Rodada {match1.current_round_number} de {match1.rounds_total}
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {question ? (
          <>
            {round1?.timer_started_at && <p className="font-display text-6xl font-bold mb-6">{Math.ceil(remainingMs / 1000)}</p>}
            <h2 className="font-display text-4xl font-bold max-w-4xl leading-snug mb-8">{question.statement}</h2>
            <div className="grid grid-cols-2 gap-6 w-full max-w-4xl mb-10">
              {question.options.map((option) => {
                const revealed = Boolean(round1?.revealed_at)
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
          <p className="font-display text-3xl opacity-70 mb-10">Preparando a próxima pergunta…</p>
        )}

        <div className="grid grid-cols-2 gap-8 w-full max-w-4xl">
          <DuoPanel label="Semifinal 1" players={players1.filter((p) => p.is_active_disputant)} flags={flags1} />
          <DuoPanel label="Semifinal 2" players={players2.filter((p) => p.is_active_disputant)} flags={flags2} />
        </div>
      </div>

      {(session.screen_message || match1.screen_message) && (
        <p className="text-center text-lg opacity-80 mt-4">{session.screen_message || match1.screen_message}</p>
      )}
    </StageShell>
  )
}

function DuoPanel({ label, players, flags }: { label: string; players: DuelPlayer[]; flags: AnswerFlag[] }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <p className="text-sm uppercase tracking-wider opacity-60 mb-3">{label}</p>
      <div className="flex justify-between gap-4">
        {players.map((p) => (
          <div key={p.id} className="text-left">
            <p className="font-medium">{p.display_name}</p>
            <p className="font-display text-3xl font-bold">{p.total_score}</p>
            {flags.some((f) => f.player_id === p.id && f.answered) && (
              <span className="inline-block mt-1 rounded-full bg-success/20 px-2.5 py-0.5 text-xs text-success">respondeu ✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
