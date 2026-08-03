import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
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
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type LiveQuizParticipant = Database['public']['Tables']['live_quiz_participants']['Row']
type LiveQuizRound = Database['public']['Tables']['live_quiz_rounds']['Row']
type AnswerFlag = Database['public']['Tables']['live_quiz_answer_flags']['Row']
type RankingRow = Database['public']['Views']['v_live_quiz_ranking']['Row']

const phaseLabel: Record<string, string> = {
  lobby: 'Lobby aberto',
  rules: 'Mostrando as regras',
  ready: 'Pronto para a próxima pergunta',
  question_shown: 'Pergunta em exibição',
  awaiting_answers: 'Aguardando respostas',
  time_up: 'Tempo encerrado',
  result_revealed: 'Resultado liberado',
  ranking: 'Mostrando ranking',
  tiebreaker_question: 'Pergunta de desempate',
  tiebreaker_answering: 'Desempate — aguardando respostas',
  tiebreaker_reveal: 'Desempate revelado',
  finalists_reveal: 'Finalistas revelados',
  duel_ready: 'Duelo final em andamento',
  duel_semifinals: 'Semifinais em andamento',
  duel_final: 'Duelo final em andamento',
  quiz_finished: 'Quiz encerrado — selecione os finalistas',
}

/**
 * Painel do apresentador do quiz coletivo: mobile-first, um botão de ação
 * principal por estado (nunca obriga a procurar o próximo comando).
 * Espelha o painel do duelo, generalizado para N participantes.
 */
export function LiveQuizPresenterPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const notify = useToast()
  const { row: session, error: sessionError, retry: retrySession } = useRealtimeRow<LiveQuizSession>('live_quiz_sessions', sessionId)
  const { rows: participants } = useRealtimeList<LiveQuizParticipant>('live_quiz_participants', 'session_id', sessionId)
  const { rows: rounds } = useRealtimeList<LiveQuizRound>('live_quiz_rounds', 'session_id', sessionId)
  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === session?.current_question_number && !r.voided) ?? null,
    [rounds, session?.current_question_number],
  )
  const { rows: flags } = useRealtimeList<AnswerFlag>('live_quiz_answer_flags', 'round_id', currentRound?.id)

  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [screenMessage, setScreenMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [selectedTied, setSelectedTied] = useState<string[]>([])
  const [extraSeconds, setExtraSeconds] = useState('10')

  useEffect(() => {
    if (!currentRound) {
      setQuestion(null)
      return
    }
    supabase
      .rpc('get_public_live_quiz_round_question', { p_round_id: currentRound.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [currentRound?.id, currentRound?.revealed_at])

  useEffect(() => {
    if (!sessionId) return
    if (session?.phase !== 'ranking' && session?.phase !== 'quiz_finished' && session?.status !== 'finished') return
    supabase
      .from('v_live_quiz_ranking')
      .select('*')
      .eq('session_id', sessionId)
      .order('rank')
      .then(({ data }) => setRanking(data ?? []))
  }, [session?.phase, session?.status, sessionId])

  async function call(fn: string, args: Record<string, unknown>, successMessage?: string) {
    setBusy(true)
    const { data, error } = await supabase.rpc(fn as never, args as never)
    setBusy(false)
    if (error) {
      notify(error.message, 'error')
      return null
    }
    if (successMessage) notify(successMessage)
    return data
  }

  // Um único botão faz tudo: seleciona os finalistas e — se não houver
  // empate pra resolver — já sorteia as duplas e inicia as semifinais (ou
  // o duelo único, no formato de 2) em seguida. Só para no meio se
  // precisar de uma decisão do apresentador (o desempate).
  async function handleSelectFinalists() {
    const data = (await call('presenter_select_live_quiz_finalists', { p_session_id: sessionId })) as unknown as
      | { needsTiebreak: boolean; tiedParticipantIds?: string[]; finalistIds?: string[] }
      | null
    if (!data) return
    if (data.needsTiebreak) {
      setSelectedTied(data.tiedParticipantIds ?? [])
      notify('Empate no corte de finalistas — rode uma pergunta de desempate abaixo.', 'error')
    } else {
      await call(
        'presenter_start_duel_from_live_quiz',
        { p_session_id: sessionId },
        session?.finalists_count === 4 ? 'Finalistas definidos — duplas sorteadas e semifinais iniciadas!' : 'Finalistas definidos — duelo final iniciado!',
      )
    }
  }

  if (sessionError) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <RetryableError message={sessionError} onRetry={retrySession} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-svh flex items-center justify-center text-primary">
        <Spinner />
      </div>
    )
  }

  const joinUrl = `${window.location.origin}/quiz/entrar/${session.code}`
  const connected = participants.filter((p) => p.connected)
  const answeredCount = flags.filter((f) => f.answered).length
  const answerablePool = currentRound?.is_tiebreaker
    ? connected.filter((p) => currentRound.tiebreak_participant_ids?.includes(p.id))
    : connected.filter((p) => !p.is_spectator)
  const answerPct = answerablePool.length > 0 ? Math.round((answeredCount / answerablePool.length) * 100) : 0

  return (
    <div className="min-h-svh bg-bg px-4 py-6 pb-10">
      <div className="max-w-xl mx-auto flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold">{session.name}</h1>
            <p className="text-ink-muted text-sm">
              Código <span className="font-mono font-semibold">{session.code}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Link to={`/telao-quiz/${sessionId}`} target="_blank">
              <Button variant="ghost" size="md">
                Abrir telão
              </Button>
            </Link>
            <Badge tone="primary">{phaseLabel[session.phase] ?? session.phase}</Badge>
          </div>
        </div>

        {session.paused && (
          <Card className="bg-danger/10 border-danger/30 text-center">
            <p className="font-semibold text-danger">⏸ Quiz pausado — participantes veem uma tela de espera.</p>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-ink-muted">Participantes</p>
            <p className="font-display text-lg font-bold">{connected.length} conectados</p>
          </div>
          {currentRound && (session.status === 'in_progress') && (
            <div className="mt-2">
              <div className="h-2 rounded-full bg-bg overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${answerPct}%` }} />
              </div>
              <p className="text-xs text-ink-muted mt-1">
                {answeredCount}/{answerablePool.length} responderam ({answerPct}%)
              </p>
            </div>
          )}
        </Card>

        {session.status === 'draft' && (
          <Card className="text-center">
            <QrCode value={joinUrl} />
            <p className="text-sm text-ink-muted mt-3">
              ou código <span className="font-mono font-semibold">{session.code}</span>
            </p>
            <Button className="w-full mt-4" disabled={busy} onClick={() => call('presenter_open_live_quiz_lobby', { p_session_id: sessionId })}>
              Abrir lobby
            </Button>
          </Card>
        )}

        {(session.status === 'lobby' || session.phase === 'rules') && (
          <Card>
            <div className="flex flex-col items-center gap-3 mb-4">
              <QrCode value={joinUrl} />
              <p className="text-sm text-ink-muted">
                ou código <span className="font-mono font-semibold">{session.code}</span>
              </p>
            </div>
            {connected.length === 0 ? (
              <p className="text-sm text-ink-muted text-center mb-4">Nenhum participante conectado ainda.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 mb-4 justify-center">
                {connected.map((p) => (
                  <li key={p.id} className="rounded-full bg-bg px-3 py-1.5 text-sm">
                    {p.display_name}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-muted text-center mb-3">O telão já mostra as regras e o QR code juntos.</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => call('presenter_lock_live_quiz_lobby', { p_session_id: sessionId, p_locked: !session.lobby_locked })}
              >
                {session.lobby_locked ? 'Reabrir entradas' : 'Bloquear novas entradas'}
              </Button>
              <Button disabled={busy} onClick={() => call('presenter_start_live_quiz', { p_session_id: sessionId }, 'Quiz iniciado!')}>
                Iniciar quiz
              </Button>
            </div>
          </Card>
        )}

        {session.status === 'in_progress' && session.phase !== 'rules' && (
          <>
            {question && (
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">
                    {currentRound?.is_tiebreaker ? 'Desempate' : `Pergunta ${session.current_question_number} de ${session.questions_total}`}
                  </p>
                </div>
                <p className="mb-3">{question.statement}</p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {question.options.map((o) => (
                    <li key={o.optionId} className={clsx(o.isCorrect && 'font-semibold text-success')}>
                      {o.isCorrect ? '✓ ' : '· '}
                      {o.text}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <div className="flex flex-wrap gap-2">
                {session.phase === 'ready' && !currentRound?.is_tiebreaker && (
                  <Button className="w-full" disabled={busy} onClick={() => call('presenter_show_live_quiz_question', { p_session_id: sessionId })}>
                    Liberar pergunta
                  </Button>
                )}
                {session.phase === 'question_shown' && (
                  <Button className="w-full" disabled={busy} onClick={() => call('presenter_start_live_quiz_timer', { p_session_id: sessionId })}>
                    Iniciar cronômetro
                  </Button>
                )}
                {(session.phase === 'awaiting_answers' || session.phase === 'tiebreaker_answering') && (
                  <>
                    <Button className="w-full" disabled={busy} onClick={() => call('presenter_end_live_quiz_question_early', { p_session_id: sessionId })}>
                      Encerrar respostas
                    </Button>
                    <div className="flex gap-2 w-full">
                      <Input
                        type="number"
                        value={extraSeconds}
                        onChange={(e) => setExtraSeconds(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => call('presenter_extend_live_quiz_timer', { p_session_id: sessionId, p_extra_seconds: Number(extraSeconds) }, 'Tempo estendido.')}
                      >
                        + segundos
                      </Button>
                    </div>
                  </>
                )}
                {currentRound &&
                  (session.phase === 'time_up' || answerPct === 100) &&
                  session.phase !== 'result_revealed' &&
                  session.phase !== 'tiebreaker_reveal' && (
                    <Button
                      className="w-full"
                      disabled={busy}
                      onClick={() => call('presenter_reveal_live_quiz_answer', { p_session_id: sessionId }, 'Resposta revelada.')}
                    >
                      Revelar resposta
                    </Button>
                  )}
                {session.phase === 'result_revealed' && !currentRound?.is_tiebreaker && (
                  <>
                    {session.show_ranking_after_question && (
                      <Button variant="ghost" className="w-full" disabled={busy} onClick={() => call('presenter_show_live_quiz_ranking', { p_session_id: sessionId })}>
                        Mostrar ranking
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      disabled={busy}
                      onClick={() => call('presenter_next_live_quiz_question', { p_session_id: sessionId })}
                    >
                      {session.current_question_number >= session.questions_total ? 'Concluir quiz' : 'Próxima pergunta'}
                    </Button>
                  </>
                )}
                {session.phase === 'ranking' && (
                  <Button className="w-full" disabled={busy} onClick={() => call('presenter_next_live_quiz_question', { p_session_id: sessionId })}>
                    {session.current_question_number >= session.questions_total ? 'Concluir quiz' : 'Próxima pergunta'}
                  </Button>
                )}
                {session.phase !== 'ready' &&
                  session.phase !== 'result_revealed' &&
                  session.phase !== 'ranking' &&
                  session.phase !== 'tiebreaker_reveal' &&
                  !currentRound?.revealed_at &&
                  currentRound && (
                    <>
                      <Button variant="ghost" disabled={busy} onClick={() => call('presenter_void_live_quiz_question', { p_session_id: sessionId }, 'Pergunta anulada.')}>
                        Anular pergunta
                      </Button>
                      <Button variant="ghost" disabled={busy} onClick={() => call('presenter_restart_live_quiz_round', { p_session_id: sessionId }, 'Rodada reiniciada.')}>
                        Reiniciar rodada
                      </Button>
                    </>
                  )}
              </div>
            </Card>
          </>
        )}

        {(session.phase === 'quiz_finished' || session.phase === 'tiebreaker_reveal') && (
          <Card>
            <h2 className="font-display text-lg font-bold mb-3">Classificação</h2>
            <ol className="flex flex-col gap-1.5 text-sm mb-4">
              {ranking.map((r) => (
                <li key={r.participant_id} className="flex justify-between">
                  <span>
                    {r.rank}º · {r.display_name}
                  </span>
                  <span className="text-ink-muted">
                    {r.total_score} pts · {r.correct_count} acertos
                  </span>
                </li>
              ))}
            </ol>
            {session.phase === 'quiz_finished' && (
              <Button className="w-full" disabled={busy} onClick={handleSelectFinalists}>
                {session.finalists_count === 4 ? 'Definir finalistas e sortear as duplas' : 'Definir finalistas e iniciar o duelo'}
              </Button>
            )}
            {selectedTied.length > 0 && (
              <Button
                variant="accent"
                className="w-full mt-2"
                disabled={busy}
                onClick={async () => {
                  const data = (await call('presenter_start_live_quiz_tiebreaker', { p_session_id: sessionId, p_participant_ids: selectedTied })) as unknown as {
                    roundId: string
                  } | null
                  if (data) setSelectedTied([])
                }}
              >
                Rodar pergunta de desempate ({selectedTied.length} empatados)
              </Button>
            )}
          </Card>
        )}

        {session.phase === 'finalists_reveal' && (
          <Card>
            <h2 className="font-display text-lg font-bold mb-3">Finalistas</h2>
            <ul className="flex flex-col gap-2 mb-4">
              {participants
                .filter((p) => p.is_finalist)
                .map((p) => (
                  <li key={p.id} className="rounded-xl bg-success/10 text-success px-4 py-2.5 font-semibold">
                    🏆 {p.display_name}
                  </li>
                ))}
            </ul>
            <Button
              className="w-full"
              disabled={busy}
              onClick={() =>
                call(
                  'presenter_start_duel_from_live_quiz',
                  { p_session_id: sessionId },
                  session.finalists_count === 4 ? 'Semifinais iniciadas!' : 'Duelo final iniciado!',
                )
              }
            >
              {session.finalists_count === 4 ? 'Iniciar semifinais' : 'Iniciar duelo final'}
            </Button>
          </Card>
        )}

        {session.phase === 'duel_semifinals' && <Navigate to={`/apresentador-semifinais/${sessionId}`} replace />}

        {(session.phase === 'duel_ready' || session.phase === 'duel_final') && session.promoted_duel_match_id && (
          <Navigate to={`/apresentador/${session.promoted_duel_match_id}`} replace />
        )}

        <Card>
          <h2 className="font-display text-base font-bold mb-3">Controles gerais</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <Button
              variant="ghost"
              size="md"
              disabled={busy}
              onClick={() => call('presenter_set_live_quiz_paused', { p_session_id: sessionId, p_paused: !session.paused })}
            >
              {session.paused ? 'Retomar' : 'Pausar'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Mensagem para o telão" value={screenMessage} onChange={(e) => setScreenMessage(e.target.value)} />
            <Button
              size="md"
              disabled={busy}
              onClick={async () => {
                await call('presenter_send_live_quiz_screen_message', { p_session_id: sessionId, p_message: screenMessage || null })
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
