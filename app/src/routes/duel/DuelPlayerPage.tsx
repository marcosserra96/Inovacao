import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import clsx from 'clsx'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { TimerRing } from '@/components/ui/TimerRing'
import { RetryableError } from '@/components/ui/RetryableError'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useDuelTimer } from '@/hooks/useDuelTimer'
import { supabase } from '@/lib/supabase'
import { loadDuelPlayer } from '@/lib/duelPlayerStorage'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type DuelPlayer = Database['public']['Tables']['duel_players']['Row']
type DuelRound = Database['public']['Tables']['duel_rounds']['Row']
type AnswerFlag = Database['public']['Tables']['duel_answer_flags']['Row']

interface RoundResult {
  roundId: string
  revealedAt: string
  winnerPlayerId: string | null
  answers: { playerId: string; optionId: string | null; isCorrect: boolean; isLate: boolean; pointsAwarded: number }[]
}

export function DuelPlayerPage() {
  const { matchId, playerId } = useParams<{ matchId: string; playerId: string }>()
  const stored = matchId ? loadDuelPlayer(matchId) : null
  const joinToken = stored && stored.playerId === playerId ? stored.joinToken : null
  const { row: match, error: matchError, retry: retryMatch } = useRealtimeRow<DuelMatch>('duel_matches', matchId)
  const { row: me, error: meError, retry: retryMe } = useRealtimeRow<DuelPlayer>('duel_players', playerId)
  const { rows: players } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', matchId)
  const { rows: rounds } = useRealtimeList<DuelRound>('duel_rounds', 'match_id', matchId)
  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === match?.current_round_number && !r.voided) ?? null,
    [rounds, match?.current_round_number],
  )
  const { rows: flags } = useRealtimeList<AnswerFlag>('duel_answer_flags', 'round_id', currentRound?.id)

  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const remainingMs = useDuelTimer(currentRound)

  useEffect(() => {
    setSelectedOptionId(null)
    setResult(null)
    if (!currentRound) {
      setQuestion(null)
      return
    }
    supabase
      .rpc('get_public_duel_round_question', { p_round_id: currentRound.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [currentRound?.id])

  useEffect(() => {
    if (!currentRound?.revealed_at) return
    supabase
      .rpc('get_duel_round_result', { p_round_id: currentRound.id })
      .then(({ data }) => setResult(data as unknown as RoundResult))
  }, [currentRound?.id, currentRound?.revealed_at])

  const iAnswered = flags.some((f) => f.player_id === playerId && f.answered)
  const opponent = players.find((p) => p.is_active_disputant && p.id !== playerId)

  async function handleAnswer(optionId: string) {
    if (!currentRound || submitting || iAnswered || !joinToken) return
    setSelectedOptionId(optionId)
    setSubmitting(true)
    await supabase.rpc('submit_duel_answer', {
      p_round_id: currentRound.id,
      p_player_id: playerId!,
      p_join_token: joinToken,
      p_option_id: optionId,
    })
    setSubmitting(false)
  }

  if (matchError || meError) {
    return (
      <PublicShell>
        <RetryableError message={matchError ?? meError ?? ''} onRetry={matchError ? retryMatch : retryMe} />
      </PublicShell>
    )
  }

  if (!match || !me) {
    return (
      <PublicShell>
        <div className="flex justify-center text-primary">
          <Spinner />
        </div>
      </PublicShell>
    )
  }

  if (!joinToken) {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Não encontramos sua entrada nesta partida</h1>
          <p className="text-ink-muted">
            Isso pode acontecer se você abrir esta página em outro navegador ou dispositivo. Volte ao link ou QR
            Code original para entrar novamente.
          </p>
        </Card>
      </PublicShell>
    )
  }

  if (!me.connected) {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Você foi desconectado</h1>
          <p className="text-ink-muted">O apresentador encerrou sua participação nesta partida.</p>
        </Card>
      </PublicShell>
    )
  }

  if (!me.is_active_disputant) {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Você está na sala de espera</h1>
          <p className="text-ink-muted">Aguarde o apresentador selecionar os disputantes desta rodada.</p>
        </Card>
      </PublicShell>
    )
  }

  if (match.status === 'finished') {
    const isWinner = match.winner_player_id === playerId
    const isDraw = !match.winner_player_id
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-3xl font-bold mb-2">
            {isDraw ? 'Empate!' : isWinner ? 'Você venceu! 🎉' : 'Fim de jogo'}
          </h1>
          <p className="text-ink-muted mb-4">
            {me.display_name}: {me.total_score} pontos {opponent && `· ${opponent.display_name}: ${opponent.total_score} pontos`}
          </p>
        </Card>
      </PublicShell>
    )
  }

  if (match.phase === 'waiting_players' || match.phase === 'players_connected' || (!currentRound && match.phase === 'ready')) {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Prepare-se, {me.display_name}!</h1>
          <p className="text-ink-muted">Aguardando o apresentador iniciar a partida.</p>
        </Card>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <div className="flex items-center justify-between mb-4">
        <Badge tone="primary">Rodada {match.current_round_number}</Badge>
        {currentRound?.timer_started_at && <TimerRing remainingMs={remainingMs} totalMs={(currentRound.timer_duration_seconds ?? 20) * 1000} />}
      </div>

      <Card>
        {!question ? (
          <div className="flex justify-center py-6 text-primary">
            <Spinner />
          </div>
        ) : (
          <>
            {question.mediaUrl && (
              <img src={question.mediaUrl} alt="" className="w-full rounded-2xl mb-4 object-cover max-h-56" />
            )}
            <h1 className="font-display text-xl font-bold mb-5 leading-snug">{question.statement}</h1>

            <div className="flex flex-col gap-3">
              {question.options.map((option) => {
                const isSelected = selectedOptionId === option.optionId
                const revealed = Boolean(currentRound?.revealed_at)
                const myAnswer = result?.answers.find((a) => a.playerId === playerId)
                const isCorrectOption = revealed && option.optionId === myAnswer?.optionId && myAnswer?.isCorrect
                const isWrongSelected = revealed && isSelected && myAnswer && !myAnswer.isCorrect

                return (
                  <button
                    key={option.optionId}
                    type="button"
                    disabled={match.phase !== 'awaiting_answers' || iAnswered}
                    onClick={() => handleAnswer(option.optionId)}
                    className={clsx(
                      'no-select rounded-2xl border-2 px-5 py-4 text-left text-base font-medium transition-all',
                      'disabled:cursor-default',
                      !revealed && isSelected && 'border-primary bg-primary/5',
                      !revealed && !isSelected && 'border-border bg-surface',
                      match.phase === 'awaiting_answers' && !iAnswered && 'hover:border-primary/40',
                      isCorrectOption && 'border-success bg-success/10 text-success',
                      isWrongSelected && 'border-danger bg-danger/10 text-danger',
                    )}
                  >
                    {option.text}
                  </button>
                )
              })}
            </div>

            <p className="text-center text-sm text-ink-muted mt-5">
              {match.phase === 'question_shown' && 'Aguarde a liberação do cronômetro…'}
              {match.phase === 'awaiting_answers' && !iAnswered && 'Toque na alternativa correta.'}
              {iAnswered && !currentRound?.revealed_at && 'Resposta registrada! Aguardando o resultado…'}
              {currentRound?.revealed_at && 'Resultado revelado pelo apresentador.'}
            </p>
          </>
        )}
      </Card>

      {match.screen_message && (
        <p className="text-center text-sm text-ink-muted mt-4">{match.screen_message}</p>
      )}
    </PublicShell>
  )
}
