import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { RetryableError } from '@/components/ui/RetryableError'
import { TimerRing } from '@/components/ui/TimerRing'
import { useCountdown } from '@/hooks/useCountdown'
import { supabase } from '@/lib/supabase'
import { loadAttempt } from '@/lib/individualAttemptStorage'
import type { Database } from '@/types/database.types'
import type { QuestionPayload } from '@/types/domain'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']

interface CurrentQuestionResponse {
  status: 'in_progress' | 'finished'
  attemptId: string
  totalQuestions?: number
  currentIndex?: number
  elapsedMs?: number
  question?: QuestionPayload
}

interface SubmitResponse {
  isCorrect: boolean
  isLate: boolean
  pointsAwarded: number
  correctOptionId: string | null
  explanation: string | null
  finished: boolean
  nextQuestion: QuestionPayload | null
}

type Phase = 'loading' | 'missing' | 'network_error' | 'playing' | 'feedback' | 'redirecting'

export function IndividualPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<SubmitResponse | null>(null)
  const totalsRef = useRef({ score: 0, correct: 0 })
  const submittedRef = useRef(false)

  const remainingMs = useCountdown(phase === 'playing' ? deadlineMs : null)

  const attempt = sessionId ? loadAttempt(sessionId) : null

  const applyQuestion = useCallback((q: QuestionPayload, index: number, total: number, elapsedMs: number) => {
    setQuestion(q)
    setCurrentIndex(index)
    setTotalQuestions(total)
    setSelectedOptionId(null)
    setFeedback(null)
    submittedRef.current = false
    setDeadlineMs(Date.now() - elapsedMs + q.timeLimitSeconds * 1000)
    setPhase('playing')
  }, [])

  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (!sessionId) return
    if (!attempt) {
      setPhase('missing')
      return
    }
    setPhase('loading')

    async function load() {
      const [{ data: sess }, { data, error }] = await Promise.all([
        supabase.from('individual_sessions').select('*').eq('id', sessionId!).maybeSingle(),
        supabase.rpc('get_current_individual_question', { p_attempt_id: attempt!.attemptId }),
      ])
      setSession(sess)

      if (error || !data) {
        setPhase('network_error')
        return
      }
      const result = data as unknown as CurrentQuestionResponse
      if (result.status === 'finished' || !result.question) {
        navigate(`/individual/${sessionId}/resultado`, { replace: true })
        return
      }
      applyQuestion(result.question, result.currentIndex ?? 0, result.totalQuestions ?? 0, result.elapsedMs ?? 0)
    }
    load().catch(() => setPhase('network_error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, retryTick])

  const submitAnswer = useCallback(
    async (optionId: string | null) => {
      if (!attempt || !question || submittedRef.current) return
      submittedRef.current = true
      setSelectedOptionId(optionId)

      const { data, error } = await supabase.rpc('submit_individual_answer', {
        p_attempt_id: attempt.attemptId,
        p_question_id: question.questionId,
        p_option_id: optionId,
      })

      if (error || !data) {
        submittedRef.current = false
        return
      }
      const result = data as unknown as SubmitResponse
      totalsRef.current = {
        score: totalsRef.current.score + result.pointsAwarded,
        correct: totalsRef.current.correct + (result.isCorrect ? 1 : 0),
      }
      setFeedback(result)
      setPhase('feedback')

      setTimeout(() => {
        if (result.finished || !result.nextQuestion) {
          setPhase('redirecting')
          navigate(`/individual/${sessionId}/resultado`, {
            replace: true,
            state: {
              totalScore: totalsRef.current.score,
              correctCount: totalsRef.current.correct,
              totalQuestions,
              participantId: attempt.participantId,
              displayName: attempt.displayName,
            },
          })
          return
        }
        applyQuestion(result.nextQuestion, currentIndex + 1, totalQuestions, 0)
      }, 1800)
    },
    [attempt, question, sessionId, navigate, currentIndex, totalQuestions, applyQuestion],
  )

  useEffect(() => {
    if (phase === 'playing' && remainingMs <= 0 && !submittedRef.current) {
      submitAnswer(null)
    }
  }, [phase, remainingMs, submitAnswer])

  if (phase === 'loading' || phase === 'redirecting') {
    return (
      <PublicShell>
        <div className="flex justify-center text-primary">
          <Spinner />
        </div>
      </PublicShell>
    )
  }

  if (phase === 'network_error') {
    return (
      <PublicShell>
        <Card>
          <RetryableError
            message="Não foi possível carregar sua pergunta. Verifique sua conexão."
            onRetry={() => setRetryTick((n) => n + 1)}
          />
        </Card>
      </PublicShell>
    )
  }

  if (phase === 'missing' || !question) {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Não encontramos sua participação</h1>
          <p className="text-ink-muted">
            Isso pode acontecer se você abrir esta página em outro navegador. Volte ao link ou QR Code original para
            começar.
          </p>
        </Card>
      </PublicShell>
    )
  }

  const showCorrectAnswer = session?.show_correct_answer ?? true

  return (
    <PublicShell>
      <div className="flex items-center justify-between mb-4">
        <Badge tone="primary">
          Pergunta {currentIndex + 1} de {totalQuestions}
        </Badge>
        <TimerRing remainingMs={remainingMs} totalMs={question.timeLimitSeconds * 1000} />
      </div>

      <Card>
        {question.mediaUrl && (
          <img src={question.mediaUrl} alt="" className="w-full rounded-2xl mb-4 object-cover max-h-56" />
        )}
        <h1 className="font-display text-xl font-bold mb-5 leading-snug">{question.statement}</h1>

        <div className="flex flex-col gap-3">
          {question.options.map((option) => {
            const isSelected = selectedOptionId === option.optionId
            const isCorrectOption = feedback && showCorrectAnswer && option.optionId === feedback.correctOptionId
            const isWrongSelected = feedback && isSelected && !feedback.isCorrect

            return (
              <button
                key={option.optionId}
                type="button"
                disabled={phase !== 'playing'}
                onClick={() => submitAnswer(option.optionId)}
                className={clsx(
                  'no-select rounded-2xl border-2 px-5 py-4 text-left text-base font-medium transition-all',
                  'disabled:cursor-default',
                  !feedback && isSelected && 'border-primary bg-primary/5',
                  !feedback && !isSelected && 'border-border bg-surface hover:border-primary/40',
                  isCorrectOption && 'border-success bg-success/10 text-success',
                  isWrongSelected && 'border-danger bg-danger/10 text-danger',
                  feedback && !isSelected && !isCorrectOption && 'border-border opacity-60',
                )}
              >
                {option.text}
              </button>
            )
          })}
        </div>

        {feedback && (
          <div className="mt-5 rounded-2xl bg-bg px-4 py-3">
            <p className={clsx('font-semibold', feedback.isCorrect ? 'text-success' : 'text-danger')}>
              {feedback.isLate ? 'Tempo esgotado' : feedback.isCorrect ? `Certinho! +${feedback.pointsAwarded} pontos` : 'Não foi dessa vez'}
            </p>
            {feedback.explanation && <p className="text-sm text-ink-muted mt-1">{feedback.explanation}</p>}
          </div>
        )}
      </Card>
    </PublicShell>
  )
}
