import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { StageShell } from '@/components/layout/StageShell'
import { QrCode } from '@/components/ui/QrCode'
import { RetryableError } from '@/components/ui/RetryableError'
import { Confetti } from '@/components/ui/Confetti'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useDuelTimer } from '@/hooks/useDuelTimer'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type LiveQuizParticipant = Database['public']['Tables']['live_quiz_participants']['Row']
type LiveQuizRound = Database['public']['Tables']['live_quiz_rounds']['Row']
type AnswerFlag = Database['public']['Tables']['live_quiz_answer_flags']['Row']
type RankingRow = Database['public']['Views']['v_live_quiz_ranking']['Row']

const DEFAULT_RULES_TEXT = `⚡ Uma pergunta por vez, para todo mundo ao mesmo tempo.
⏱️ Responda rápido — quanto mais rápido, mais pontos.
🔒 Só dá pra responder uma vez.
🏆 Os {finalistas} melhores avançam para o duelo ao vivo.`

function parseRules(rulesText: string | null | undefined, finalistsCount: number): string[] {
  return (rulesText || DEFAULT_RULES_TEXT)
    .split('\n')
    .map((line) => line.trim().replaceAll('{finalistas}', String(finalistsCount)))
    .filter(Boolean)
}

export function LiveQuizScreenPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { theme } = useTheme()
  const { row: session, error: sessionError, retry: retrySession } = useRealtimeRow<LiveQuizSession>('live_quiz_sessions', sessionId)
  const { rows: participants } = useRealtimeList<LiveQuizParticipant>('live_quiz_participants', 'session_id', sessionId)
  const { rows: rounds } = useRealtimeList<LiveQuizRound>('live_quiz_rounds', 'session_id', sessionId)
  const currentRound = useMemo(
    () => rounds.find((r) => r.round_number === session?.current_question_number && !r.voided) ?? null,
    [rounds, session?.current_question_number],
  )
  const { rows: flags } = useRealtimeList<AnswerFlag>('live_quiz_answer_flags', 'round_id', currentRound?.id)
  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const remainingMs = useDuelTimer(currentRound)

  const connected = participants.filter((p) => p.connected)
  const answerablePool = currentRound?.is_tiebreaker
    ? connected.filter((p) => currentRound.tiebreak_participant_ids?.includes(p.id))
    : connected.filter((p) => !p.is_spectator)
  const answeredCount = flags.filter((f) => f.answered).length

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
    const wantsRanking = session?.phase === 'ranking' || session?.phase === 'quiz_finished' || session?.status === 'finished'
    if (!wantsRanking) return
    supabase
      .from('v_live_quiz_ranking')
      .select('*')
      .eq('session_id', sessionId)
      .order('rank')
      .limit(session?.phase === 'ranking' ? (session?.ranking_size ?? 10) : 100)
      .then(({ data }) => setRanking(data ?? []))
  }, [session?.phase, session?.status, session?.ranking_size, sessionId])

  const joinUrl = session ? `${window.location.origin}/quiz/entrar/${session.code}` : ''

  if (sessionError) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center">
          <RetryableError message={sessionError} onRetry={retrySession} tone="dark" />
        </div>
      </StageShell>
    )
  }

  if (!session) {
    return (
      <StageShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-2xl opacity-70">Carregando quiz…</p>
        </div>
      </StageShell>
    )
  }

  if (session.status === 'draft' || session.status === 'lobby' || session.phase === 'rules') {
    const rules = parseRules(session.rules_text, session.finalists_count)
    return (
      <StageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="font-display text-lg uppercase tracking-[0.3em] opacity-70">{theme.eventName}</p>
          <h1 className="font-display text-4xl font-bold">{session.name}</h1>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-12 items-center px-8">
          <div className="text-left">
            <h2 className="font-display text-3xl font-bold mb-6">Como funciona</h2>
            <ul className="flex flex-col gap-4 text-xl opacity-90 max-w-xl">
              {rules.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-center gap-4 text-center">
            <QrCode value={joinUrl} size={200} />
            <p className="text-xl">
              Entre com o código <span className="font-display font-bold tracking-widest">{session.code}</span>
            </p>
            <p className="text-lg opacity-70">{connected.length} pessoa{connected.length === 1 ? '' : 's'} no lobby</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {connected.slice(0, 30).map((p) => (
                <span key={p.id} className="rounded-full bg-white/10 px-3 py-1 text-sm">
                  {p.display_name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </StageShell>
    )
  }

  if (session.phase === 'finalists_reveal') {
    const finalists = participants.filter((p) => p.is_finalist)
    return (
      <StageShell>
        <Confetti />
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <p className="font-display text-2xl uppercase tracking-[0.3em] opacity-70">Os finalistas são</p>
          <div className="flex gap-16">
            {finalists.map((p, i) => (
              <div key={p.id} className="animate-pop" style={{ animationDelay: `${i * 0.4}s` }}>
                <p className="font-display text-6xl font-bold">{p.display_name}</p>
                <p className="text-xl opacity-70 mt-2">{p.total_score} pontos</p>
              </div>
            ))}
          </div>
        </div>
      </StageShell>
    )
  }

  if ((session.phase === 'duel_ready' || session.phase === 'duel_final') && session.promoted_duel_match_id) {
    return <Navigate to={`/telao/${session.promoted_duel_match_id}`} replace />
  }

  if (session.status === 'finished') {
    return (
      <StageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="font-display text-2xl uppercase tracking-[0.3em] opacity-70">Etapa final</p>
          <h1 className="font-display text-5xl font-bold">Dinâmica encerrada!</h1>
        </div>
      </StageShell>
    )
  }

  if (session.phase === 'duel_semifinals') {
    return <Navigate to={`/telao-semifinais/${sessionId}`} replace />
  }

  if (session.phase === 'quiz_finished') {
    return (
      <StageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <h1 className="font-display text-5xl font-bold">Fim do quiz coletivo!</h1>
          <RankingList ranking={ranking} />
        </div>
      </StageShell>
    )
  }

  if (session.phase === 'ranking') {
    return (
      <StageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <h1 className="font-display text-4xl font-bold">Ranking parcial</h1>
          <RankingList ranking={ranking} />
        </div>
      </StageShell>
    )
  }

  return (
    <StageShell>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg uppercase tracking-[0.2em] opacity-70">{session.name}</p>
        <p className="font-display text-lg opacity-70">
          {currentRound?.is_tiebreaker ? 'Desempate' : `Pergunta ${session.current_question_number} de ${session.questions_total}`}
        </p>
      </div>

      <p className="text-center text-lg opacity-70 mt-2">
        {answeredCount}/{answerablePool.length} responderam
      </p>

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

      {session.screen_message && <p className="text-center text-lg opacity-80 mt-4">{session.screen_message}</p>}
      {session.paused && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-stage-bg/90">
          <p className="font-display text-4xl font-bold">⏸ Pausa</p>
        </div>
      )}
    </StageShell>
  )
}

function RankingList({ ranking }: { ranking: RankingRow[] }) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl">
      {ranking.map((r) => (
        <div
          key={r.participant_id}
          className={clsx(
            'flex items-center justify-between rounded-2xl px-6 py-4 text-2xl',
            r.rank <= 3 ? 'bg-accent/20 font-bold' : 'bg-white/5',
          )}
        >
          <span>
            {r.rank}º · {r.display_name}
          </span>
          <span className="font-display font-bold">{r.total_score} pts</span>
        </div>
      ))}
    </div>
  )
}
