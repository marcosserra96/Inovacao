import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { RetryableError } from '@/components/ui/RetryableError'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type DuelPlayer = Database['public']['Tables']['duel_players']['Row']
type DuelRound = Database['public']['Tables']['duel_rounds']['Row']

const phaseLabel: Record<string, string> = {
  ready: 'Pronta para a próxima pergunta',
  question_shown: 'Pergunta em exibição',
  awaiting_answers: 'Aguardando respostas',
  answers_received: 'Respostas recebidas',
  time_up: 'Tempo encerrado',
  result_revealed: 'Resultado liberado',
}

/**
 * Painel único das semifinais: um só fluxo de botões controla as duas
 * duplas ao mesmo tempo (mesma pergunta, mesmo cronômetro) via as RPCs
 * *_paired_duel_*. Cada dupla ainda encerra/declara vencedor de forma
 * independente — só a pergunta/ritmo é compartilhado.
 */
export function LiveQuizSemifinalsPresenterPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const notify = useToast()
  const { row: session, error: sessionError, retry: retrySession } = useRealtimeRow<LiveQuizSession>('live_quiz_sessions', sessionId)
  const { row: match1 } = useRealtimeRow<DuelMatch>('duel_matches', session?.semifinal1_match_id ?? undefined)
  const { row: match2 } = useRealtimeRow<DuelMatch>('duel_matches', session?.semifinal2_match_id ?? undefined)
  const { rows: players1 } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', session?.semifinal1_match_id ?? undefined)
  const { rows: players2 } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', session?.semifinal2_match_id ?? undefined)
  const { rows: rounds1 } = useRealtimeList<DuelRound>('duel_rounds', 'match_id', session?.semifinal1_match_id ?? undefined)

  const round1 = useMemo(
    () => rounds1.find((r) => r.round_number === match1?.current_round_number && !r.voided) ?? null,
    [rounds1, match1?.current_round_number],
  )

  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!round1) {
      setQuestion(null)
      return
    }
    supabase
      .rpc('get_public_duel_round_question', { p_round_id: round1.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [round1?.id, round1?.revealed_at])

  async function call(fn: string, args: Record<string, unknown>, successMessage?: string) {
    setBusy(true)
    const { error } = await supabase.rpc(fn as never, args as never)
    setBusy(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    if (successMessage) notify(successMessage)
  }

  if (sessionError) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <RetryableError message={sessionError} onRetry={retrySession} />
      </div>
    )
  }

  if (!session || !match1 || !match2) {
    return (
      <div className="min-h-svh flex items-center justify-center text-primary">
        <Spinner />
      </div>
    )
  }

  const phase = match1.phase
  const bothDecided = match1.status === 'finished' && Boolean(match1.winner_player_id) && match2.status === 'finished' && Boolean(match2.winner_player_id)

  return (
    <div className="min-h-svh bg-bg px-4 py-6 pb-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold">{session.name} — Semifinais</h1>
            <p className="text-ink-muted text-sm">Rodada {match1.current_round_number} de {match1.rounds_total}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Link to={`/telao-semifinais/${sessionId}`} target="_blank">
              <Button variant="ghost" size="md">
                Abrir telão
              </Button>
            </Link>
            {!bothDecided && <Badge tone="primary">{phaseLabel[phase] ?? phase}</Badge>}
          </div>
        </div>

        {bothDecided && session.promoted_duel_match_id ? (
          <Navigate to={`/apresentador/${session.promoted_duel_match_id}`} replace />
        ) : bothDecided ? (
          <Card className="text-center">
            <p className="font-semibold text-success mb-3">Semifinais encerradas! Preparando a final…</p>
            <Button disabled={busy} onClick={() => call('presenter_start_live_quiz_final', { p_session_id: sessionId }, 'Final iniciada!')}>
              Iniciar final
            </Button>
          </Card>
        ) : (
          <>
            <Card>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <DuoScore label="Semifinal 1" players={players1.filter((p) => p.is_active_disputant)} />
                <DuoScore label="Semifinal 2" players={players2.filter((p) => p.is_active_disputant)} />
              </div>

              {question && (
                <div className="mb-5 rounded-2xl bg-bg p-4">
                  <p className="font-medium mb-3">{question.statement}</p>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {question.options.map((o) => (
                      <li key={o.optionId} className={clsx(o.isCorrect && 'font-semibold text-success')}>
                        {o.isCorrect ? '✓ ' : '· '}
                        {o.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {phase === 'ready' && (
                  <Button className="w-full" disabled={busy} onClick={() => call('presenter_show_paired_duel_question', { p_match_id: match1.id })}>
                    Liberar pergunta
                  </Button>
                )}
                {phase === 'question_shown' && (
                  <Button className="w-full" disabled={busy} onClick={() => call('presenter_start_paired_duel_timer', { p_match_id: match1.id })}>
                    Iniciar cronômetro
                  </Button>
                )}
                {phase === 'awaiting_answers' && (
                  <>
                    {round1?.timer_paused_at ? (
                      <Button variant="ghost" disabled={busy} onClick={() => call('presenter_resume_paired_duel_timer', { p_match_id: match1.id })}>
                        Retomar
                      </Button>
                    ) : (
                      <Button variant="ghost" disabled={busy} onClick={() => call('presenter_pause_paired_duel_timer', { p_match_id: match1.id })}>
                        Pausar
                      </Button>
                    )}
                    <Button disabled={busy} onClick={() => call('presenter_end_paired_duel_question_early', { p_match_id: match1.id })}>
                      Encerrar pergunta
                    </Button>
                  </>
                )}
                {(phase === 'time_up' || phase === 'answers_received') && (
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() => call('presenter_reveal_paired_duel_answer', { p_match_id: match1.id }, 'Resposta revelada.')}
                  >
                    Revelar resposta
                  </Button>
                )}
                {phase === 'result_revealed' && (
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() => call('presenter_next_paired_duel_round', { p_match_id: match1.id })}
                  >
                    {match1.current_round_number >= match1.rounds_total ? 'Concluir rodadas' : 'Próxima rodada'}
                  </Button>
                )}
                {phase !== 'ready' && phase !== 'result_revealed' && !round1?.revealed_at && (
                  <>
                    <Button variant="ghost" disabled={busy} onClick={() => call('presenter_void_paired_duel_question', { p_match_id: match1.id }, 'Pergunta anulada.')}>
                      Anular pergunta
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => call('presenter_restart_paired_duel_round', { p_match_id: match1.id }, 'Rodada reiniciada.')}>
                      Reiniciar rodada
                    </Button>
                  </>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <MatchResolution match={match1} label="Semifinal 1" players={players1.filter((p) => p.is_active_disputant)} busy={busy} call={call} />
              <MatchResolution match={match2} label="Semifinal 2" players={players2.filter((p) => p.is_active_disputant)} busy={busy} call={call} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DuoScore({ label, players }: { label: string; players: DuelPlayer[] }) {
  return (
    <div className="rounded-2xl bg-bg p-3.5">
      <p className="text-xs font-semibold text-ink-muted mb-2">{label}</p>
      <div className="flex justify-between gap-2">
        {players.map((p) => (
          <div key={p.id}>
            <p className="text-sm font-medium">{p.display_name}</p>
            <p className="font-display text-xl font-bold text-primary">{p.total_score} pts</p>
            <p className="text-xs text-ink-muted">{p.correct_count} acertos</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchResolution({
  match,
  label,
  players,
  busy,
  call,
}: {
  match: DuelMatch
  label: string
  players: DuelPlayer[]
  busy: boolean
  call: (fn: string, args: Record<string, unknown>, successMessage?: string) => Promise<void>
}) {
  const decided = match.status === 'finished' && Boolean(match.winner_player_id)
  const tied = match.status === 'finished' && !match.winner_player_id
  const winner = players.find((p) => p.id === match.winner_player_id)

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">{label}</p>
        <Link to={`/apresentador/${match.id}`} target="_blank" className="text-xs text-ink-muted hover:text-ink underline">
          Painel individual
        </Link>
      </div>

      {decided && <p className="text-sm text-success font-medium">🏆 {winner?.display_name} venceu</p>}

      {tied && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-danger font-medium mb-1">Empate!</p>
          <Button
            size="md"
            disabled={busy}
            onClick={() =>
              call(
                'presenter_extend_duel_tiebreak',
                { p_match_id: match.id },
                'Rodada extra liberada — continue no painel individual dessa semifinal.',
              )
            }
          >
            Rodar pergunta de desempate
          </Button>
          {players.map((p) => (
            <Button
              key={p.id}
              size="md"
              variant="ghost"
              disabled={busy}
              onClick={() => call('presenter_end_match', { p_match_id: match.id, p_winner_player_id: p.id }, `${p.display_name} definido como vencedor.`)}
            >
              Declarar {p.display_name} vencedor
            </Button>
          ))}
        </div>
      )}

      {match.status === 'in_progress' && (
        <div className="flex flex-col gap-1.5">
          <Button
            size="md"
            variant="danger"
            disabled={busy}
            onClick={() => call('presenter_end_match', { p_match_id: match.id, p_winner_player_id: null }, `${label} encerrada.`)}
          >
            Encerrar automaticamente
          </Button>
          {players.map((p) => (
            <Button
              key={p.id}
              size="md"
              variant="ghost"
              disabled={busy}
              onClick={() => call('presenter_end_match', { p_match_id: match.id, p_winner_player_id: p.id }, `${p.display_name} definido como vencedor.`)}
            >
              Declarar {p.display_name} vencedor
            </Button>
          ))}
        </div>
      )}
    </Card>
  )
}
