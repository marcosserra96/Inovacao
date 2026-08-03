import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { TimerRing } from '@/components/ui/TimerRing'
import { RetryableError } from '@/components/ui/RetryableError'
import { SparkBadge } from '@/components/ui/SparkBadge'
import { AnswerFlash } from '@/components/ui/AnswerFlash'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useDuelTimer } from '@/hooks/useDuelTimer'
import { useCountUp } from '@/hooks/useCountUp'
import { supabase } from '@/lib/supabase'
import { loadLiveQuizParticipant } from '@/lib/liveQuizStorage'
import { saveDuelPlayer } from '@/lib/duelPlayerStorage'
import { OPTION_COLORS } from '@/lib/optionColors'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type LiveQuizParticipant = Database['public']['Tables']['live_quiz_participants']['Row']
type LiveQuizRound = Database['public']['Tables']['live_quiz_rounds']['Row']
type AnswerFlag = Database['public']['Tables']['live_quiz_answer_flags']['Row']
type RankingRow = Database['public']['Views']['v_live_quiz_ranking']['Row']
type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type DuelPlayer = Database['public']['Tables']['duel_players']['Row']

interface RoundResult {
  roundId: string
  revealedAt: string
  answers: { participantId: string; optionId: string | null; isCorrect: boolean; isLate: boolean; pointsAwarded: number }[]
}

export function LiveQuizPlayerPage() {
  const { sessionId, participantId } = useParams<{ sessionId: string; participantId: string }>()
  const navigate = useNavigate()
  const stored = sessionId && participantId ? loadLiveQuizParticipant(sessionId, participantId) : null
  const joinToken = stored && stored.participantId === participantId ? stored.joinToken : null

  const { row: session, error: sessionError, retry: retrySession } = useRealtimeRow<LiveQuizSession>('live_quiz_sessions', sessionId)
  const { row: me, error: meError, retry: retryMe } = useRealtimeRow<LiveQuizParticipant>('live_quiz_participants', participantId)
  const { rows: rounds } = useRealtimeList<LiveQuizRound>('live_quiz_rounds', 'session_id', sessionId)
  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === session?.current_question_number && !r.voided) ?? null,
    [rounds, session?.current_question_number],
  )
  const { rows: flags } = useRealtimeList<AnswerFlag>('live_quiz_answer_flags', 'round_id', currentRound?.id)

  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [flashTone, setFlashTone] = useState<'correct' | 'wrong' | 'late' | null>(null)

  const remainingMs = useDuelTimer(currentRound)

  useEffect(() => {
    setSelectedOptionId(null)
    setResult(null)
    setQuestion(null)
  }, [currentRound?.id])

  // Refaz esta busca também quando revealed_at muda (mesma rodada) — sem
  // isso, a resposta certa nunca acendia em verde no próprio celular até
  // dar F5, porque build_question_payload só entrega isCorrect de verdade
  // depois da revelação.
  useEffect(() => {
    if (!currentRound) return
    supabase
      .rpc('get_public_live_quiz_round_question', { p_round_id: currentRound.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [currentRound?.id, currentRound?.revealed_at])

  useEffect(() => {
    if (!currentRound?.revealed_at) return
    supabase
      .rpc('get_live_quiz_round_result', { p_round_id: currentRound.id })
      .then(({ data }) => setResult(data as unknown as RoundResult))
  }, [currentRound?.id, currentRound?.revealed_at])

  useEffect(() => {
    if (session?.phase !== 'ranking' || !sessionId) return
    supabase
      .from('v_live_quiz_ranking')
      .select('*')
      .eq('session_id', sessionId)
      .order('rank')
      .limit(session.ranking_size)
      .then(({ data }) => setRanking(data ?? []))
  }, [session?.phase, sessionId, session?.ranking_size])

  // Finalista promovido: busca a nova identidade no duelo e troca de tela
  // sozinho, sem exigir novo cadastro nem novo código.
  useEffect(() => {
    if (!me?.promoted_duel_player_id || !participantId || !joinToken || promoting) return
    setPromoting(true)
    supabase
      .rpc('get_my_live_quiz_promotion', { p_participant_id: participantId, p_join_token: joinToken })
      .then(({ data }) => {
        const promotion = data as unknown as { promoted: boolean; duelMatchId?: string; duelPlayerId?: string; duelJoinToken?: string }
        if (promotion.promoted && promotion.duelMatchId && promotion.duelPlayerId && promotion.duelJoinToken) {
          saveDuelPlayer(promotion.duelMatchId, { playerId: promotion.duelPlayerId, joinToken: promotion.duelJoinToken })
          navigate(`/duelo/${promotion.duelMatchId}/jogar/${promotion.duelPlayerId}`, { replace: true })
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.promoted_duel_player_id])

  const iAnswered = flags.some((f) => f.participant_id === participantId && f.answered)
  const myResult = result?.answers.find((a) => a.participantId === participantId)
  const myRanking = ranking.find((r) => r.participant_id === participantId)
  const pointsCounted = useCountUp(myResult?.pointsAwarded ?? 0, Boolean(myResult?.isCorrect))

  useEffect(() => {
    if (!myResult) return
    setFlashTone(myResult.isCorrect ? 'correct' : myResult.isLate ? 'late' : 'wrong')
    const timer = setTimeout(() => setFlashTone(null), 500)
    return () => clearTimeout(timer)
  }, [myResult?.isCorrect, myResult?.isLate, currentRound?.id])

  async function handleAnswer(optionId: string) {
    if (!currentRound || submitting || iAnswered || !joinToken) return
    setSelectedOptionId(optionId)
    setSubmitting(true)
    await supabase.rpc('submit_live_quiz_answer', {
      p_round_id: currentRound.id,
      p_participant_id: participantId!,
      p_join_token: joinToken,
      p_option_id: optionId,
    })
    setSubmitting(false)
  }

  if (sessionError || meError) {
    return (
      <PublicShell>
        <RetryableError message={sessionError ?? meError ?? ''} onRetry={sessionError ? retrySession : retryMe} />
      </PublicShell>
    )
  }

  if (!session || !me) {
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
          <h1 className="font-display text-xl font-bold mb-2">Não encontramos sua entrada neste quiz</h1>
          <p className="text-ink-muted">
            Isso pode acontecer se você abrir esta página em outro navegador ou dispositivo. Volte ao link ou QR Code
            original para entrar novamente.
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
          <p className="text-ink-muted">O apresentador encerrou sua participação neste quiz.</p>
        </Card>
      </PublicShell>
    )
  }

  if (session.status === 'cancelled') {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Quiz cancelado</h1>
        </Card>
      </PublicShell>
    )
  }

  if (promoting || (me.promoted_duel_player_id && session.phase !== 'finalists_reveal')) {
    return (
      <PublicShell>
        <div className="flex flex-col items-center gap-4 text-center">
          <Spinner />
          <p className="text-ink-muted">Preparando o duelo final…</p>
        </div>
      </PublicShell>
    )
  }

  // Modo espectador: participante não-finalista, quiz já foi além da
  // seleção de finalistas. Placar público do duelo, sem token/segredo.
  // Durante as semifinais (formato de 4 finalistas), ainda não há um único
  // duelo pra embutir o placar (são 2 rodando em sequência) — mostra uma
  // tela simples direcionando pro telão em vez de tentar escolher qual.
  if (me.is_spectator && session.phase === 'duel_semifinals') {
    return (
      <PublicShell>
        <Card className="text-center">
          <Badge tone="accent" className="mb-3">
            Modo espectador
          </Badge>
          <h1 className="font-display text-xl font-bold mb-1">Semifinais em andamento!</h1>
          <p className="text-ink-muted text-sm">{me.display_name}, acompanhe os duelos no telão.</p>
        </Card>
      </PublicShell>
    )
  }

  if (me.is_spectator && (session.phase === 'duel_ready' || session.phase === 'duel_final' || session.promoted_duel_match_id)) {
    return <LiveQuizSpectatorView matchId={session.promoted_duel_match_id!} myName={me.display_name} />
  }

  if (session.phase === 'lobby' || session.status === 'draft') {
    return (
      <PublicShell>
        <Card className="text-center">
          <SparkBadge icon="bolt" className="mb-4 h-16 w-16" />
          <h1 className="font-display text-xl font-bold mb-2">Você está no lobby, {me.display_name}!</h1>
          <p className="text-ink-muted">Aguarde o apresentador iniciar o quiz.</p>
        </Card>
      </PublicShell>
    )
  }

  if (session.phase === 'rules') {
    return (
      <PublicShell>
        <Card>
          <h1 className="font-display text-xl font-bold mb-4 text-center">Como funciona</h1>
          <ul className="flex flex-col gap-3 text-sm text-ink-muted">
            <li>⚡ Uma pergunta por vez, para todo mundo ao mesmo tempo.</li>
            <li>⏱️ Responda rápido — quanto mais rápido, mais pontos.</li>
            <li>🔒 Só dá pra responder uma vez, e não dá pra mudar depois.</li>
            <li>🏆 Os {session.finalists_count} melhores no final avançam para o duelo ao vivo.</li>
          </ul>
        </Card>
      </PublicShell>
    )
  }

  if (session.phase === 'finalists_reveal') {
    return (
      <PublicShell>
        <Card className="text-center">
          {me.is_finalist ? (
            <>
              <SparkBadge icon="bolt" className="mb-4 h-16 w-16" />
              <h1 className="font-display text-2xl font-extrabold mb-2 text-primary-dark">Você é finalista! 🎉</h1>
              <p className="text-ink-muted">Prepare-se — o duelo final está começando.</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold mb-2">Os finalistas foram definidos</h1>
              <p className="text-ink-muted">Obrigado por participar! Acompanhe o duelo final no telão.</p>
            </>
          )}
        </Card>
      </PublicShell>
    )
  }

  if (session.phase === 'quiz_finished') {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Quiz encerrado!</h1>
          <p className="text-ink-muted">Aguarde — o apresentador vai revelar os finalistas.</p>
        </Card>
      </PublicShell>
    )
  }

  if (session.phase === 'ranking') {
    return (
      <PublicShell>
        <Card>
          <h1 className="font-display text-lg font-bold mb-1 text-center">Ranking parcial</h1>
          {myRanking && (
            <p className="text-center text-sm text-ink-muted mb-4">
              Você está em <span className="font-semibold text-primary">{myRanking.rank}º</span> lugar, com{' '}
              <span className="font-semibold">{myRanking.total_score} pts</span>.
            </p>
          )}
          <ol className="flex flex-col gap-2">
            {ranking.map((r, i) => (
              <li
                key={r.participant_id}
                className={clsx(
                  'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm animate-pop',
                  r.participant_id === participantId ? 'bg-primary/10 font-semibold text-primary' : 'bg-bg',
                )}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <span>
                  {r.rank}º · {r.display_name}
                </span>
                <span>{r.total_score} pts</span>
              </li>
            ))}
          </ol>
        </Card>
      </PublicShell>
    )
  }

  if (session.phase === 'ready' || (!currentRound && session.status === 'in_progress')) {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Prepare-se, {me.display_name}!</h1>
          <p className="text-ink-muted">Aguardando a próxima pergunta…</p>
        </Card>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      {flashTone && <AnswerFlash tone={flashTone} />}
      <div className="flex items-center justify-between mb-4">
        <Badge tone="primary">
          {currentRound?.is_tiebreaker ? 'Desempate' : `Pergunta ${session.current_question_number}`}
        </Badge>
        {currentRound?.timer_started_at && (
          <TimerRing remainingMs={remainingMs} totalMs={(currentRound.timer_duration_seconds ?? 20) * 1000} />
        )}
      </div>

      <Card>
        {!question ? (
          <div className="flex justify-center py-6 text-primary">
            <Spinner />
          </div>
        ) : currentRound?.is_tiebreaker && !currentRound.tiebreak_participant_ids?.includes(participantId!) ? (
          <p className="text-center text-ink-muted py-6">Rodada de desempate — aguarde, ela não é para você.</p>
        ) : (
          <>
            {question.mediaUrl && (
              <img src={question.mediaUrl} alt="" className="w-full rounded-2xl mb-4 object-cover max-h-56" />
            )}
            {!session.hide_statement_on_phone && (
              <h1 className="font-display text-xl font-extrabold mb-5 leading-snug text-primary-dark">{question.statement}</h1>
            )}

            <div className="flex flex-col gap-3">
              {question.options.map((option, index) => {
                const isSelected = selectedOptionId === option.optionId
                const revealed = Boolean(currentRound?.revealed_at)
                // A alternativa correta vem do próprio payload da pergunta
                // (question.options[].isCorrect, já revelado pelo servidor)
                // — não de bater com a resposta da pessoa. Assim, quem errou
                // ou respondeu fora do prazo também vê qual era a certa,
                // igual ao telão.
                const isCorrectOption = revealed && option.isCorrect === true
                // Resposta tardia zera o option_id no servidor (nunca sabemos mais o
                // que a pessoa tocou) — não dá pra marcar de vermelho como "errada"
                // sem confundir quem só demorou um instante a mais.
                const isLateSelected = revealed && isSelected && myResult?.isLate
                const isWrongSelected = revealed && isSelected && myResult && !myResult.isCorrect && !myResult.isLate
                const markerColor = OPTION_COLORS[index % OPTION_COLORS.length]
                const answering = currentRound?.phase === 'awaiting_answers' || currentRound?.phase === 'tiebreaker_answering'

                return (
                  <button
                    key={option.optionId}
                    type="button"
                    disabled={!answering || iAnswered}
                    onClick={() => handleAnswer(option.optionId)}
                    className={clsx(
                      'no-select flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-base font-semibold transition-all',
                      'disabled:cursor-default',
                      !revealed && isSelected && 'border-primary bg-primary/5',
                      !revealed && !isSelected && 'border-border bg-surface',
                      answering && !iAnswered && 'hover:-translate-y-0.5 hover:shadow-md',
                      isCorrectOption && 'border-success bg-success/10 text-success',
                      isWrongSelected && 'border-danger bg-danger/10 text-danger',
                      isLateSelected && 'border-accent bg-accent/10 text-accent',
                    )}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: markerColor }}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option.text}
                  </button>
                )
              })}
            </div>

            <p className="text-center text-sm text-ink-muted mt-5">
              {currentRound?.phase === 'question_shown' && 'Aguarde a liberação do cronômetro…'}
              {(currentRound?.phase === 'awaiting_answers' || currentRound?.phase === 'tiebreaker_answering') &&
                !iAnswered &&
                'Toque na alternativa correta.'}
              {iAnswered && !currentRound?.revealed_at && 'Resposta registrada! Aguardando o resultado…'}
              {currentRound?.revealed_at &&
                (myResult ? (
                  myResult.isCorrect ? (
                    <>
                      Certa resposta! <span className="font-bold text-success">+{pointsCounted} pontos.</span>
                    </>
                  ) : myResult.isLate ? (
                    'Resposta fora do prazo.'
                  ) : (
                    'Resposta incorreta.'
                  )
                ) : (
                  'Resultado revelado pelo apresentador.'
                ))}
            </p>
          </>
        )}
      </Card>

      {session.screen_message && <p className="text-center text-sm text-ink-muted mt-4">{session.screen_message}</p>}
    </PublicShell>
  )
}

/**
 * Tela do participante que não avançou para o duelo: vira espectador,
 * acompanhando o placar público do duelo final ao vivo (sem precisar de
 * token — os dados do duelo são públicos, só a submissão de resposta é
 * protegida).
 */
function LiveQuizSpectatorView({ matchId, myName }: { matchId: string; myName: string }) {
  const { row: match } = useRealtimeRow<DuelMatch>('duel_matches', matchId)
  const { rows: players } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', matchId)
  const disputants = players.filter((p) => p.is_active_disputant)

  return (
    <PublicShell>
      <Card className="text-center">
        <Badge tone="accent" className="mb-3">
          Modo espectador
        </Badge>
        <h1 className="font-display text-xl font-bold mb-1">Torça pelo duelo final!</h1>
        <p className="text-ink-muted text-sm mb-6">
          {myName}, você não avançou desta vez — acompanhe o placar ao vivo aqui.
        </p>

        {match?.status === 'finished' ? (
          <p className="font-display text-lg font-bold text-primary">
            {players.find((p) => p.id === match.winner_player_id)?.display_name ?? 'Empate'} 🏆
          </p>
        ) : (
          <div className="flex justify-center gap-8">
            {disputants.map((p) => (
              <div key={p.id}>
                <p className="text-sm text-ink-muted">{p.display_name}</p>
                <p className="font-display text-3xl font-extrabold text-primary">{p.total_score}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PublicShell>
  )
}
