import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { QrCode } from '@/components/ui/QrCode'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { RetryableError } from '@/components/ui/RetryableError'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type DuelPlayer = Database['public']['Tables']['duel_players']['Row']
type DuelRound = Database['public']['Tables']['duel_rounds']['Row']
type DuelAnswer = Database['public']['Tables']['duel_answers']['Row']

const phaseLabel: Record<string, string> = {
  waiting_players: 'Aguardando participantes',
  players_connected: 'Participantes conectados',
  ready: 'Pronta para a próxima pergunta',
  question_shown: 'Pergunta em exibição',
  awaiting_answers: 'Aguardando respostas',
  answers_received: 'Respostas recebidas',
  time_up: 'Tempo encerrado',
  result_revealed: 'Resultado liberado',
  match_ended: 'Partida encerrada',
}

export function PresenterPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const notify = useToast()
  const { role } = useAuth()
  const { row: match, error: matchError, retry: retryMatch } = useRealtimeRow<DuelMatch>('duel_matches', matchId)
  const { rows: players } = useRealtimeList<DuelPlayer>('duel_players', 'match_id', matchId)
  const { rows: rounds } = useRealtimeList<DuelRound>('duel_rounds', 'match_id', matchId)
  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === match?.current_round_number && !r.voided) ?? null,
    [rounds, match?.current_round_number],
  )
  const { rows: answers } = useRealtimeList<DuelAnswer>('duel_answers', 'round_id', currentRound?.id)

  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [selectedDisputants, setSelectedDisputants] = useState<string[]>([])
  const [screenMessage, setScreenMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!currentRound) {
      setQuestion(null)
      return
    }
    supabase
      .rpc('get_public_duel_round_question', { p_round_id: currentRound.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [currentRound?.id, currentRound?.revealed_at])

  async function call(fn: string, args: Record<string, unknown>, successMessage?: string) {
    setBusy(true)
    const { error } = await supabase.rpc(fn as never, args as never)
    setBusy(false)
    if (error) {
      notify(error.message, 'error')
      return false
    }
    if (successMessage) notify(successMessage)
    return true
  }

  async function handleStartMatch() {
    if (selectedDisputants.length !== 2) {
      notify('Selecione exatamente 2 participantes.', 'error')
      return
    }
    const ok = await call('presenter_select_disputants', { p_match_id: matchId, p_player_ids: selectedDisputants })
    if (!ok) return
    await call('presenter_start_match', { p_match_id: matchId }, 'Partida iniciada!')
  }

  async function handleNextRound() {
    setBusy(true)
    const { data, error } = await supabase.rpc('presenter_next_round', { p_match_id: matchId! })
    setBusy(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    const result = data as unknown as { matchComplete: boolean }
    if (result.matchComplete) {
      notify('Todas as rodadas concluídas — encerre a partida quando quiser.')
    }
  }

  if (matchError) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <RetryableError message={matchError} onRetry={retryMatch} />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-svh flex items-center justify-center text-primary">
        <Spinner />
      </div>
    )
  }

  const joinUrl = `${window.location.origin}/duelo/entrar/${match.code}`
  const disputants = players.filter((p) => p.is_active_disputant)

  return (
    <div className="min-h-svh bg-bg px-6 py-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">{match.name ?? 'Duelo ao vivo'}</h1>
            <p className="text-ink-muted text-sm">
              Código <span className="font-mono font-semibold">{match.code}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/telao/${matchId}`} target="_blank">
              <Button variant="ghost" size="md">
                Abrir telão
              </Button>
            </Link>
            <Badge tone="primary">{phaseLabel[match.phase]}</Badge>
          </div>
        </div>

        {match.status === 'lobby' && (
          <Card>
            <h2 className="font-display text-lg font-bold mb-4">Lobby — selecione os disputantes</h2>
            <div className="flex flex-col items-center gap-3 mb-6">
              <QrCode value={joinUrl} />
              <p className="text-sm text-ink-muted">ou código: <span className="font-mono font-semibold">{match.code}</span></p>
            </div>
            {players.length === 0 ? (
              <p className="text-sm text-ink-muted text-center">Nenhum participante conectado ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2 mb-4">
                {players.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <input
                      type="checkbox"
                      disabled={!p.connected}
                      checked={selectedDisputants.includes(p.id)}
                      onChange={(e) =>
                        setSelectedDisputants((prev) =>
                          e.target.checked ? [...prev, p.id].slice(-2) : prev.filter((id) => id !== p.id),
                        )
                      }
                    />
                    <span className={clsx('flex-1', !p.connected && 'text-ink-muted line-through')}>{p.display_name}</span>
                    {p.connected ? (
                      <Button
                        size="md"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => call('presenter_disconnect_player', { p_player_id: p.id }, 'Participante desconectado.')}
                      >
                        Remover
                      </Button>
                    ) : (
                      <Button
                        size="md"
                        variant="ghost"
                        onClick={() => call('presenter_set_player_connected', { p_player_id: p.id, p_connected: true }, 'Participante reconectado.')}
                      >
                        Reconectar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Button className="w-full" disabled={busy || selectedDisputants.length !== 2} onClick={handleStartMatch}>
              Iniciar partida
            </Button>
          </Card>
        )}

        {match.status === 'in_progress' && (
          <>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold">
                  Rodada {match.current_round_number} de {match.rounds_total}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                {disputants.map((p) => (
                  <div key={p.id} className="rounded-2xl bg-bg px-4 py-3">
                    <p className="font-medium">{p.display_name}</p>
                    <p className="font-display text-2xl font-bold text-primary">{p.total_score} pts</p>
                    <p className="text-xs text-ink-muted">{p.correct_count} acertos</p>
                  </div>
                ))}
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
                  {answers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border text-sm flex flex-col gap-2">
                      {disputants.map((p) => {
                        const answer = answers.find((a) => a.player_id === p.id)
                        return (
                          <div key={p.id} className="flex items-center gap-2">
                            <p className="text-ink-muted flex-1">
                              {p.display_name}: {answer ? (answer.is_correct ? `✅ correto (${answer.points_awarded} pts)` : '❌ incorreto') : 'aguardando…'}
                            </p>
                            {currentRound?.revealed_at && answer && role === 'admin' && (
                              <>
                                <Input
                                  type="number"
                                  className="w-20"
                                  defaultValue={answer.points_awarded}
                                  id={`score-${p.id}`}
                                />
                                <Button
                                  size="md"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    const input = document.getElementById(`score-${p.id}`) as HTMLInputElement
                                    call(
                                      'presenter_set_manual_score',
                                      { p_round_id: currentRound.id, p_player_id: p.id, p_points: Number(input.value) },
                                      'Pontuação corrigida.',
                                    )
                                  }}
                                >
                                  Corrigir
                                </Button>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {match.phase === 'ready' && (
                  <Button disabled={busy} onClick={() => call('presenter_show_question', { p_match_id: matchId })}>
                    Liberar pergunta
                  </Button>
                )}
                {match.phase === 'question_shown' && (
                  <Button disabled={busy} onClick={() => call('presenter_start_timer', { p_match_id: matchId })}>
                    Iniciar cronômetro
                  </Button>
                )}
                {match.phase === 'awaiting_answers' && (
                  <>
                    {currentRound?.timer_paused_at ? (
                      <Button variant="ghost" disabled={busy} onClick={() => call('presenter_resume_timer', { p_match_id: matchId })}>
                        Retomar
                      </Button>
                    ) : (
                      <Button variant="ghost" disabled={busy} onClick={() => call('presenter_pause_timer', { p_match_id: matchId })}>
                        Pausar
                      </Button>
                    )}
                    <Button disabled={busy} onClick={() => call('presenter_end_question_early', { p_match_id: matchId })}>
                      Encerrar pergunta
                    </Button>
                  </>
                )}
                {(match.phase === 'answers_received' || match.phase === 'time_up') && (
                  <Button disabled={busy} onClick={() => call('presenter_reveal_answer', { p_match_id: matchId }, 'Resposta revelada.')}>
                    Revelar resposta
                  </Button>
                )}
                {match.phase === 'result_revealed' && (
                  <Button disabled={busy} onClick={handleNextRound}>
                    {match.current_round_number >= match.rounds_total ? 'Concluir rodadas' : 'Próxima rodada'}
                  </Button>
                )}
                {match.phase !== 'ready' && match.phase !== 'result_revealed' && !currentRound?.revealed_at && (
                  <>
                    <Button variant="ghost" disabled={busy} onClick={() => call('presenter_void_question', { p_match_id: matchId }, 'Pergunta anulada.')}>
                      Anular pergunta
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => call('presenter_restart_round', { p_match_id: matchId }, 'Rodada reiniciada.')}>
                      Reiniciar rodada
                    </Button>
                  </>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="font-display text-lg font-bold mb-3">Encerrar partida</h2>
              <div className="flex gap-2 flex-wrap">
                <Button variant="danger" disabled={busy} onClick={() => call('presenter_end_match', { p_match_id: matchId, p_winner_player_id: null }, 'Partida encerrada.')}>
                  Encerrar automaticamente
                </Button>
                {disputants.map((p) => (
                  <Button
                    key={p.id}
                    variant="ghost"
                    disabled={busy}
                    onClick={() => call('presenter_end_match', { p_match_id: matchId, p_winner_player_id: p.id }, `${p.display_name} definido como vencedor.`)}
                  >
                    Declarar {p.display_name} vencedor
                  </Button>
                ))}
              </div>
            </Card>
          </>
        )}

        <Card>
          <h2 className="font-display text-lg font-bold mb-3">Controles gerais</h2>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Button
              variant="ghost"
              size="md"
              disabled={busy}
              onClick={() => call('presenter_lock_match', { p_match_id: matchId, p_locked: !match.locked }, match.locked ? 'Entradas liberadas.' : 'Entradas bloqueadas.')}
            >
              {match.locked ? 'Desbloquear entradas' : 'Bloquear novas entradas'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Mensagem para o telão"
              value={screenMessage}
              onChange={(e) => setScreenMessage(e.target.value)}
            />
            <Button
              size="md"
              disabled={busy}
              onClick={async () => {
                await call('presenter_send_screen_message', { p_match_id: matchId, p_message: screenMessage || null })
                setScreenMessage('')
              }}
            >
              Enviar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
