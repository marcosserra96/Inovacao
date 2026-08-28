import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useServerClock } from '@/hooks/useServerClock'
import type { QuestionPayload } from '@/types/domain'

type Session = any
type Participant = any
type Round = any
type DuelMatch = any
type DuelPlayer = any

type RoundResult = {
  roundId: string
  revealedAt: string
  answers: Array<{
    participantId: string
    optionId: string | null
    isCorrect: boolean
    isLate: boolean
    pointsAwarded: number
  }> | null
}

type DuelRoundResult = {
  roundId: string
  revealedAt: string
  winnerPlayerId: string | null
  answers: Array<{
    playerId: string
    optionId: string | null
    isCorrect: boolean
    isLate: boolean
    pointsAwarded: number
  }> | null
}

type Promotion = {
  promoted: boolean
  duelMatchId?: string
  duelPlayerId?: string
  duelJoinToken?: string
}

type DuelState = {
  promotion: Promotion | null
  match: DuelMatch | null
  player: DuelPlayer | null
  opponent: DuelPlayer | null
  round: Round | null
  question: QuestionPayload | null
  answered: boolean
  myResult: DuelRoundResult['answers'] extends Array<infer T> | null ? T | null : never
}

const EMPTY_DUEL: DuelState = {
  promotion: null,
  match: null,
  player: null,
  opponent: null,
  round: null,
  question: null,
  answered: false,
  myResult: null,
}

function isBracketFlow(flow?: string | null) {
  return Boolean(flow && (flow.startsWith('semifinal') || flow.startsWith('final') || flow === 'champion'))
}

export function useParticipantLiveState(sessionId?: string, participantId?: string, joinToken?: string | null) {
  const [session, setSession] = useState<Session | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [answered, setAnswered] = useState(false)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [duel, setDuel] = useState<DuelState>(EMPTY_DUEL)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)

  const clockKey = session
    ? `${session.flow_state ?? ''}:${session.flow_deadline_at ?? ''}:${session.paused ? 1 : 0}`
    : null
  const { serverNowMs } = useServerClock(sessionId, clockKey)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!sessionId || !participantId) return
    let active = true
    let loading = false

    const clearCollective = () => {
      setRound(null)
      setQuestion(null)
      setAnswered(false)
      setResult(null)
    }

    const loadDuel = async (sessionData: Session) => {
      if (!joinToken || !isBracketFlow(sessionData?.flow_state)) {
        setDuel(EMPTY_DUEL)
        return
      }

      const { data: promotionData, error: promotionError } = await supabase.rpc('get_my_live_quiz_promotion', {
        p_participant_id: participantId,
        p_join_token: joinToken,
      })

      if (!active) return
      if (promotionError || !promotionData) {
        setDuel(EMPTY_DUEL)
        return
      }

      const promotion = promotionData as unknown as Promotion
      if (!promotion.promoted || !promotion.duelMatchId || !promotion.duelPlayerId || !promotion.duelJoinToken) {
        setDuel({ ...EMPTY_DUEL, promotion })
        return
      }

      const [{ data: matchData }, { data: playerData }, { data: playersData }] = await Promise.all([
        supabase.from('duel_matches').select('*').eq('id', promotion.duelMatchId).maybeSingle(),
        supabase.from('duel_players').select('*').eq('id', promotion.duelPlayerId).maybeSingle(),
        supabase.from('duel_players').select('*').eq('match_id', promotion.duelMatchId).eq('is_active_disputant', true),
      ])

      if (!active || !matchData || !playerData) return

      const opponent = (playersData ?? []).find((p: any) => p.id !== promotion.duelPlayerId) ?? null
      const roundNumber = Number((matchData as any).current_round_number ?? 0)
      let duelRound: Round | null = null
      let duelQuestion: QuestionPayload | null = null
      let duelAnswered = false
      let duelMyResult: any = null

      if (roundNumber > 0) {
        const { data: roundData } = await supabase
          .from('duel_rounds')
          .select('*')
          .eq('match_id', promotion.duelMatchId)
          .eq('round_number', roundNumber)
          .eq('voided', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!active) return
        duelRound = roundData ?? null

        if (duelRound) {
          const [{ data: questionData }, { data: flagData }] = await Promise.all([
            supabase.rpc('get_public_duel_round_question', { p_round_id: (duelRound as any).id }),
            supabase
              .from('duel_answer_flags')
              .select('answered')
              .eq('round_id', (duelRound as any).id)
              .eq('player_id', promotion.duelPlayerId)
              .maybeSingle(),
          ])

          if (!active) return
          duelQuestion = (questionData as unknown as QuestionPayload) ?? null
          duelAnswered = Boolean((flagData as any)?.answered)

          if ((duelRound as any).revealed_at) {
            const { data: duelResultData } = await supabase.rpc('get_duel_round_result', { p_round_id: (duelRound as any).id })
            const duelResult = (duelResultData as unknown as DuelRoundResult) ?? null
            duelMyResult = (duelResult?.answers ?? []).find((answer) => answer.playerId === promotion.duelPlayerId) ?? null
          }
        }
      }

      setDuel({
        promotion,
        match: matchData,
        player: playerData,
        opponent,
        round: duelRound,
        question: duelQuestion,
        answered: duelAnswered,
        myResult: duelMyResult,
      })
    }

    const load = async () => {
      if (!active || loading) return
      loading = true

      try {
        const [{ data: sessionData, error: sessionError }, { data: participantData, error: participantError }] = await Promise.all([
          supabase.from('live_quiz_sessions').select('*').eq('id', sessionId).maybeSingle(),
          supabase.from('live_quiz_participants').select('*').eq('id', participantId).eq('session_id', sessionId).maybeSingle(),
        ])

        if (!active) return
        if (sessionError || participantError || !sessionData || !participantData) {
          setError('Não foi possível sincronizar sua participação.')
          return
        }

        setSession(sessionData)
        setParticipant(participantData)
        setError(null)

        if (isBracketFlow((sessionData as any).flow_state)) {
          clearCollective()
          await loadDuel(sessionData)
          return
        }

        setDuel(EMPTY_DUEL)
        const questionNumber = Number((sessionData as any).current_question_number ?? 0)
        if (questionNumber <= 0) {
          clearCollective()
          return
        }

        const { data: roundData, error: roundError } = await supabase
          .from('live_quiz_rounds')
          .select('*')
          .eq('session_id', sessionId)
          .eq('round_number', questionNumber)
          .eq('voided', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!active) return
        if (roundError || !roundData) {
          clearCollective()
          return
        }

        setRound(roundData)

        const [{ data: questionData }, { data: flagData }] = await Promise.all([
          supabase.rpc('get_public_live_quiz_round_question', { p_round_id: (roundData as any).id }),
          supabase
            .from('live_quiz_answer_flags')
            .select('answered')
            .eq('round_id', (roundData as any).id)
            .eq('participant_id', participantId)
            .maybeSingle(),
        ])

        if (!active) return
        setQuestion((questionData as unknown as QuestionPayload) ?? null)
        setAnswered(Boolean((flagData as any)?.answered))

        if ((roundData as any).revealed_at) {
          const { data: resultData } = await supabase.rpc('get_live_quiz_round_result', { p_round_id: (roundData as any).id })
          if (active) setResult((resultData as unknown as RoundResult) ?? null)
        } else if (active) {
          setResult(null)
        }
      } catch {
        if (active) setError('Não foi possível sincronizar sua participação.')
      } finally {
        loading = false
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 600)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [sessionId, participantId, joinToken])

  const authoritativeNow = serverNowMs(now)
  const remainingMs = session?.paused
    ? Number(session?.flow_remaining_ms ?? 0)
    : session?.flow_deadline_at
      ? Math.max(0, new Date(session.flow_deadline_at).getTime() - authoritativeNow)
      : 0

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const myResult = (result?.answers ?? []).find((answer) => answer.participantId === participantId) ?? null

  return {
    session,
    participant,
    round,
    question,
    answered,
    myResult,
    duel,
    remainingSeconds,
    error,
  }
}
