import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRealtimeList } from '@/hooks/useRealtimeList'
import { useRealtimeRow } from '@/hooks/useRealtimeRow'
import { useServerClock } from '@/hooks/useServerClock'
import type { QuestionPayload } from '@/types/domain'

type Session = any
type Participant = any
type Round = any
type AnswerFlag = any
type RankingRow = any

const AUTO_FLOW_STATES = new Set([
  'prepare', 'question', 'reveal', 'ranking',
  'semifinal_prepare', 'semifinal_question', 'semifinal_reveal',
  'final_prepare', 'final_question', 'final_reveal',
])

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

  const clockKey = session
    ? `${session.flow_state ?? ''}:${session.flow_deadline_at ?? ''}:${session.paused ? 1 : 0}`
    : null
  const { offsetMs, synced: clockSynced, serverNowMs, resync: resyncClock } = useServerClock(sessionId, clockKey)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [])

  // Apenas estados com deadline disparam avanço automático. A chamada é
  // agendada para o instante do servidor; não existe mais polling de 400 ms
  // nem tick antecipado durante toda a pergunta.
  useEffect(() => {
    if (!sessionId || !session || session.paused || !AUTO_FLOW_STATES.has(session.flow_state) || !session.flow_deadline_at) return

    let active = true
    let ticking = false
    const deadline = new Date(session.flow_deadline_at).getTime()

    const tick = async () => {
      if (!active || ticking) return
      ticking = true
      const { error: tickError } = await supabase.rpc('tick_current_dynamic_flow' as never, {
        p_session_id: sessionId,
      } as never)
      ticking = false

      if (active && !tickError) {
        retry()
        void resyncClock()
      }
    }

    const authoritativeNow = Date.now() + offsetMs
    const delay = Math.max(0, deadline - authoritativeNow + 30)
    const timeout = window.setTimeout(() => void tick(), delay)

    // Fallback leve para abas throttled/reconexões. Só ocorre depois do
    // deadline; não gera chamadas contínuas enquanto a pergunta está aberta.
    const fallback = window.setTimeout(() => void tick(), delay + 1200)

    return () => {
      active = false
      window.clearTimeout(timeout)
      window.clearTimeout(fallback)
    }
  }, [
    sessionId,
    session?.flow_state,
    session?.flow_deadline_at,
    session?.paused,
    offsetMs,
    clockSynced,
    retry,
    resyncClock,
  ])

  useEffect(() => {
    if (!currentRound?.id) {
      setQuestion(null)
      return
    }
    void supabase
      .rpc('get_public_live_quiz_round_question', { p_round_id: currentRound.id })
      .then(({ data, error: questionError }) => {
        if (questionError || !data) {
          setQuestion(null)
          return
        }
        setQuestion(data as unknown as QuestionPayload)
      })
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

  const authoritativeNow = serverNowMs(now)
  const remainingMs = session?.paused
    ? Number(session.flow_remaining_ms ?? 0)
    : session?.flow_deadline_at
      ? Math.max(0, new Date(session.flow_deadline_at).getTime() - authoritativeNow)
      : 0

  const rawRemainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const isPrepare = session?.flow_state === 'prepare' || session?.flow_state === 'semifinal_prepare' || session?.flow_state === 'final_prepare'
  const remainingSeconds = isPrepare && !session?.paused && session?.flow_deadline_at
    ? Math.max(1, rawRemainingSeconds)
    : rawRemainingSeconds

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
    clockSynced,
  }
}
