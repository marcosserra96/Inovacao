import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { QuestionPayload } from '@/types/domain'

type Session = any
type Participant = any
type Round = any

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

export function useParticipantLiveState(sessionId?: string, participantId?: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [answered, setAnswered] = useState(false)
  const [result, setResult] = useState<RoundResult | null>(null)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!sessionId || !participantId) return
    let active = true
    let loading = false

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

        const questionNumber = Number((sessionData as any).current_question_number ?? 0)
        if (questionNumber <= 0) {
          setRound(null)
          setQuestion(null)
          setAnswered(false)
          setResult(null)
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
          setRound(null)
          setQuestion(null)
          setAnswered(false)
          setResult(null)
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
  }, [sessionId, participantId])

  const remainingMs = session?.paused
    ? Number(session?.flow_remaining_ms ?? 0)
    : session?.flow_deadline_at
      ? Math.max(0, new Date(session.flow_deadline_at).getTime() - now)
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
    remainingSeconds,
    error,
  }
}
