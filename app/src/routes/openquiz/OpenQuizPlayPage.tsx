import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { loadAttempt } from '@/lib/individualAttemptStorage'
import { useCountdown } from '@/hooks/useCountdown'
import type { QuestionPayload } from '@/types/domain'

interface CurrentQuestionResponse {
  status: 'in_progress' | 'finished'
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

export function OpenQuizPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const attempt = sessionId ? loadAttempt(sessionId) : null
  const [question, setQuestion] = useState<QuestionPayload | null>(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<SubmitResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const submittedRef = useRef(false)
  const remainingMs = useCountdown(feedback ? null : deadlineMs)

  const applyQuestion = useCallback((q: QuestionPayload, index: number, total: number, elapsedMs: number) => {
    setQuestion(q)
    setCurrentIndex(index)
    setTotalQuestions(total)
    setSelected(null)
    setFeedback(null)
    submittedRef.current = false
    setDeadlineMs(Date.now() - elapsedMs + q.timeLimitSeconds * 1000)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!sessionId || !attempt) return
    supabase.rpc('get_current_individual_question', { p_attempt_id: attempt.attemptId }).then(({ data }) => {
      const result = data as unknown as CurrentQuestionResponse | null
      if (!result || result.status === 'finished' || !result.question) {
        navigate('/participar', { replace: true })
        return
      }
      applyQuestion(result.question, result.currentIndex ?? 0, result.totalQuestions ?? 0, result.elapsedMs ?? 0)
    })
  }, [sessionId, attempt?.attemptId, applyQuestion, navigate])

  const submitAnswer = useCallback(async (optionId: string | null) => {
    if (!attempt || !question || submittedRef.current) return
    submittedRef.current = true
    setSelected(optionId)
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
    setFeedback(result)
    setTimeout(() => {
      if (result.finished || !result.nextQuestion) {
        navigate('/participar', { replace: true })
      } else {
        applyQuestion(result.nextQuestion, currentIndex + 1, totalQuestions, 0)
      }
    }, 1800)
  }, [attempt, question, currentIndex, totalQuestions, applyQuestion, navigate])

  useEffect(() => {
    if (!loading && !feedback && remainingMs <= 0 && !submittedRef.current) submitAnswer(null)
  }, [remainingMs, loading, feedback, submitAnswer])

  if (!attempt || loading || !question) {
    return <main className="grid min-h-[100dvh] place-items-center bg-[#020d23] text-white/55">Carregando pergunta…</main>
  }

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const letters = ['A','B','C','D','E','F']

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#020d23] px-5 pb-5 pt-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_4%,rgba(0,159,194,.26),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(243,112,33,.10),transparent_25%),linear-gradient(180deg,#04122d_0%,#020d23_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-36px)] max-w-md flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="font-display text-[19px] font-extrabold tracking-[-.045em]"><span className="text-[#009FC2]">Quiz </span>Energisa</div>
          <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-6 w-auto" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.17em] text-[#009FC2]">Pergunta {currentIndex + 1}</div>
              <div className="mt-1.5 text-xs font-semibold text-white/48">de {totalQuestions}</div>
            </div>
            <div className="grid h-[62px] w-[62px] place-items-center rounded-full border-[5px] border-white/8 border-t-[#F37021]">
              <span className="font-display text-xl font-extrabold text-[#F9A56F]">{String(seconds).padStart(2,'0')}</span>
            </div>
          </div>

          <h1 className="mt-5 font-display text-[22px] font-extrabold leading-[1.16] tracking-[-.035em]">{question.statement}</h1>

          <div className="mt-5 grid flex-1 gap-2.5">
            {question.options.map((option, index) => {
              const isSelected = selected === option.optionId
              const correct = feedback?.correctOptionId === option.optionId
              const wrongSelected = feedback && isSelected && !feedback.isCorrect
              return (
                <button
                  key={option.optionId}
                  disabled={Boolean(feedback)}
                  onClick={() => submitAnswer(option.optionId)}
                  className={`flex min-h-[64px] items-center gap-3 rounded-2xl border px-3 text-left transition ${correct ? 'border-[#009FC2]/55 bg-[#009FC2]/12' : wrongSelected ? 'border-[#F37021]/50 bg-[#F37021]/10' : isSelected ? 'border-[#009FC2]/45 bg-[#009FC2]/8' : 'border-white/10 bg-white/[.04]'}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#009FC2]/25 bg-[#009FC2]/8 font-display text-base font-extrabold text-[#5DDCF2]">{letters[index] ?? index+1}</span>
                  <span className="text-[13px] font-semibold leading-snug text-white/86">{option.text}</span>
                </button>
              )
            })}
          </div>

          {feedback && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-center ${feedback.isCorrect ? 'border-[#009FC2]/25 bg-[#009FC2]/8 text-[#62DDEF]' : 'border-[#F37021]/25 bg-[#F37021]/8 text-[#FFC29A]'}`}>
              <div className="font-display text-lg font-extrabold">{feedback.isLate ? 'Tempo esgotado' : feedback.isCorrect ? 'Mandou bem!' : 'Quase!'}</div>
              <div className="mt-1 text-xs font-semibold">{feedback.isCorrect ? `+${feedback.pointsAwarded} pontos` : 'Siga para a próxima'}</div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
