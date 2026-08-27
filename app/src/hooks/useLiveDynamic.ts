import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import type { QuestionPayload } from '@/types/domain'

type Session = any
type Participant = any
type Round = any
type AnswerFlag = any
type RankingRow = any

export function useLiveDynamic(sessionId?: string) {
  const { row: session, error, retry } = useRealtimeRow<Session>('live_quiz_sessions', sessionId)
  const { rows: participants } = useRealtimeList<Participant>('live_quiz_participants', 'session_id', sessionId)
  const { rows: rounds } = useRealtimeList<Round>('live_quiz_rounds', 'session_id', sessionId)

  const currentRound = useMemo(
    () => rounds.find((round) => round.round_number === session?.current_question_number && !round.voided) ?? null,
    [rounds, session?.current_question_number],
  )

  const { rows: flags } = useRealtimeList<AnswerFlag>('live_quiz_answer_flags', 'round_id', currentRound?.id)
  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [ranking, setRanking] = useState<RankingRow[]>([])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!sessionId || !session || session.paused || !session.flow_deadline_at) return
    const timer = window.setInterval(() => {
      void supabase.rpc('tick_live_quiz_flow' as never, { p_session_id: sessionId } as never)
    }, 500)
    return () => window.clearInterval(timer)
  }, [sessionId, session?.flow_state, session?.flow_deadline_at, session?.paused])

  useEffect(() => {
    if (!currentRound?.id) {
      setQuestion(null)
      return
    }
    void supabase
      .rpc('get_public_live_quiz_round_question', { p_round_id: currentRound.id })
      .then(({ data }) => setQuestion((data as unknown as QuestionPayload) ?? null))
  }, [currentRound?.id, currentRound?.revealed_at])

  useEffect(() => {
    if (!sessionId) return
    const load = () => {
      void supabase
        .from('v_live_quiz_ranking')
        .select('*')
        .eq('session_id', sessionId)
        .order('rank')
        .limit(10)
        .then(({ data }) => setRanking((data ?? []) as RankingRow[]))
    }
    load()
    const timer = window.setInterval(load, 1500)
    return () => window.clearInterval(timer)
  }, [sessionId])

  const connected = participants.filter((participant) => participant.connected)
  const answerable = currentRound?.is_tiebreaker
    ? connected.filter((participant) => currentRound.tiebreak_participant_ids?.includes(participant.id))
    : connected.filter((participant) => !participant.is_spectator)
  const answeredCount = flags.filter((flag) => flag.answered).length
  const answerPercent = answerable.length ? Math.min(100, Math.round((answeredCount / answerable.length) * 100)) : 0

  const remainingMs = session?.paused
    ? Number(session.flow_remaining_ms ?? 0)
    : session?.flow_deadline_at
      ? Math.max(0, new Date(session.flow_deadline_at).getTime() - now)
      : 0
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))

  return {
    session,
    error,
    retry,
    participants,
    connected,
    currentRound,
    question,
    ranking,
    answeredCount,
    answerableCount: answerable.length,
    answerPercent,
    remainingMs,
    remainingSeconds,
  }
}
