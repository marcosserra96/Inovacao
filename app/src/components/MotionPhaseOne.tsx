import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

type Experience = 'screen' | 'presenter' | 'participant' | null
type CoreStage = 'other' | 'prepare' | 'question' | 'reveal'

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
}

function experienceFromPath(pathname: string): Experience {
  if (pathname.startsWith('/telao-dinamica/') || pathname === '/telao-visual') return 'screen'
  if (pathname === '/' || pathname.startsWith('/apresentador-visual')) return 'presenter'
  if (
    pathname.startsWith('/participante/') ||
    pathname.startsWith('/participar/') ||
    pathname.startsWith('/quiz/entrar/') ||
    pathname === '/participante-visual'
  ) return 'participant'
  return null
}

function detectCoreStage(textValue: string): CoreStage {
  const text = normalize(textValue)
  if (text.includes('resposta correta') || text.includes('resposta revelada') || text.includes('mandou bem') || text.includes('quase')) return 'reveal'
  if (text.includes('prepare-se') || text.includes('próxima pergunta')) return 'prepare'
  if (
    (text.includes('quiz coletivo') || text.includes('semifinal') || text.includes('grande final')) &&
    (text.includes('pergunta') || text.includes('rodada') || text.includes('tempo restante') || text.includes(' × '))
  ) return 'question'
  return 'other'
}

function restart(element: HTMLElement, className: string) {
  element.classList.remove(className)
  void element.offsetWidth
  element.classList.add(className)
}

function leaves(main: HTMLElement) {
  return Array.from(main.querySelectorAll<HTMLElement>('div, span, p, h1, h2'))
    .filter((element) => element.children.length === 0)
}

function largestNumericLeaf(main: HTMLElement) {
  return leaves(main)
    .filter((element) => /^\d{1,2}$/.test((element.textContent ?? '').trim()))
    .map((element) => ({ element, size: Number.parseFloat(getComputedStyle(element).fontSize) || 0 }))
    .sort((a, b) => b.size - a.size)[0]?.element ?? null
}

function questionHeading(main: HTMLElement) {
  return Array.from(main.querySelectorAll<HTMLElement>('h1'))
    .map((element) => ({ element, length: normalize(element.textContent ?? '').length }))
    .sort((a, b) => b.length - a.length)[0]?.element ?? null
}

function optionCandidates(main: HTMLElement) {
  return Array.from(main.querySelectorAll<HTMLElement>('button, div')).filter((element) => {
    if (element.children.length < 2 || element.children.length > 5) return false
    const first = normalize(element.firstElementChild?.textContent ?? '').toUpperCase()
    return /^[A-F]$/.test(first) && (element.textContent?.length ?? 0) < 700
  }).slice(0, 6)
}

function timerShell(main: HTMLElement) {
  const number = largestNumericLeaf(main)
  if (!number) return null
  let current: HTMLElement | null = number
  for (let i = 0; i < 4 && current; i += 1) {
    if (current.querySelector('svg')) return current
    current = current.parentElement
  }
  return number.parentElement
}

function decoratePrepare(main: HTMLElement, experience: Experience, lastCountdown: string) {
  const number = largestNumericLeaf(main)
  if (!number) return lastCountdown
  const value = (number.textContent ?? '').trim()
  if (!value || value === lastCountdown) return lastCountdown

  number.classList.add('m1-countdown-number')
  restart(number, 'm1-countdown-hit')

  const parent = number.parentElement
  if (parent) {
    parent.classList.add('m1-countdown-stage')
    restart(parent, 'm1-countdown-ring')
  }

  if (experience === 'screen' && value === '1') {
    const surface = document.querySelector<HTMLElement>('#root main')
    if (surface) restart(surface, 'm1-prepare-flash')
  }

  return value
}

function decorateQuestion(main: HTMLElement, questionSignature: string) {
  const heading = questionHeading(main)
  if (heading) {
    heading.dataset.m1Question = questionSignature
    restart(heading, 'm1-question-title-in')
  }

  const eyebrow = leaves(main).find((element) => {
    const text = normalize(element.textContent ?? '')
    return text.includes('quiz coletivo') || text.startsWith('semifinal') || text.includes('grande final')
  })
  if (eyebrow) restart(eyebrow, 'm1-question-meta-in')

  optionCandidates(main).forEach((option, index) => {
    option.style.setProperty('--m1-index', String(index))
    restart(option, 'm1-option-in')
  })

  const timer = timerShell(main)
  if (timer) restart(timer, 'm1-timer-in')
}

function decorateUrgency(main: HTMLElement, lastTimer: string) {
  const number = largestNumericLeaf(main)
  if (!number) return lastTimer
  const value = (number.textContent ?? '').trim()
  if (!value || value === lastTimer) return lastTimer

  const numeric = Number(value)
  number.classList.toggle('m1-timer-critical', numeric <= 2)
  number.classList.toggle('m1-timer-warning', numeric <= 5 && numeric > 2)
  if (numeric <= 5) restart(number, numeric <= 2 ? 'm1-critical-hit' : 'm1-warning-hit')
  return value
}

function decorateParticipantAnswer(main: HTMLElement) {
  if (!normalize(main.innerText).includes('resposta registrada')) return

  optionCandidates(main).forEach((option) => {
    if (option.dataset.m1AnswerDone === '1') return
    const selected = option.className.includes('border-[#a7d52c]')
    option.classList.add(selected ? 'm1-answer-selected' : 'm1-answer-muted')
    option.dataset.m1AnswerDone = '1'
  })

  const confirmation = leaves(main).find((element) => normalize(element.textContent ?? '') === 'resposta registrada')
  if (confirmation && confirmation.dataset.m1ConfirmDone !== '1') {
    confirmation.dataset.m1ConfirmDone = '1'
    restart(confirmation, 'm1-answer-confirm')
  }
}

function decoratePresenterRevealClock(main: HTMLElement) {
  const shell = timerShell(main)
  if (!shell || shell.dataset.m1RevealHidden === '1') return
  shell.dataset.m1RevealHidden = '1'
  shell.dataset.m1PreviousOpacity = shell.style.opacity
  shell.style.opacity = '0'
  shell.style.pointerEvents = 'none'
}

function clearPresenterRevealClock(main: HTMLElement) {
  main.querySelectorAll<HTMLElement>('[data-m1-reveal-hidden="1"]').forEach((element) => {
    element.style.opacity = element.dataset.m1PreviousOpacity ?? ''
    element.style.pointerEvents = ''
    delete element.dataset.m1RevealHidden
    delete element.dataset.m1PreviousOpacity
  })
}

function decorateReveal(main: HTMLElement) {
  const textLeaves = leaves(main)
  const badge = textLeaves.find((element) => {
    const text = normalize(element.textContent ?? '')
    return text === 'resposta correta' || text === 'mandou bem!' || text === 'quase!'
  })
  if (badge) restart(badge, 'm1-reveal-badge-in')

  const big = textLeaves
    .map((element) => ({ element, size: Number.parseFloat(getComputedStyle(element).fontSize) || 0 }))
    .sort((a, b) => b.size - a.size)[0]?.element
  if (big) restart(big, 'm1-reveal-main-in')

  const surface = document.querySelector<HTMLElement>('#root main')
  if (surface) restart(surface, 'm1-reveal-sweep')
}

export function MotionPhaseOne() {
  const { pathname } = useLocation()
  const experience = useMemo(() => experienceFromPath(pathname), [pathname])
  const [earlyFinish, setEarlyFinish] = useState(false)
  const earlyFinishTimeout = useRef<number | null>(null)
  const revealDelayTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (!experience) return

    let previousStage: CoreStage = 'other'
    let lastCountdown = ''
    let lastTimer = ''
    let lastQuestion = ''
    let lastQuestionTimerValue = 0
    let frame = 0

    const scan = () => {
      const main = document.querySelector<HTMLElement>('#root main')
      if (!main) return

      const stage = detectCoreStage(main.innerText ?? '')
      const numericLeaf = largestNumericLeaf(main)
      const numericValue = Number((numericLeaf?.textContent ?? '0').trim())

      if (stage === 'prepare') {
        lastCountdown = decoratePrepare(main, experience, lastCountdown)
      }

      if (stage === 'question') {
        clearPresenterRevealClock(main)
        const heading = questionHeading(main)
        const signature = normalize(heading?.textContent ?? '')
        if (signature && signature !== lastQuestion) {
          decorateQuestion(main, signature)
          lastQuestion = signature
          lastTimer = ''
        }
        lastTimer = decorateUrgency(main, lastTimer)
        if (Number.isFinite(numericValue)) lastQuestionTimerValue = numericValue
        if (experience === 'participant') decorateParticipantAnswer(main)
      }

      if (stage === 'reveal') {
        if (experience === 'presenter') decoratePresenterRevealClock(main)

        if (previousStage === 'question') {
          const endedEarly = lastQuestionTimerValue >= 2

          if ((experience === 'screen' || experience === 'presenter') && endedEarly) {
            setEarlyFinish(true)
            if (earlyFinishTimeout.current) window.clearTimeout(earlyFinishTimeout.current)
            earlyFinishTimeout.current = window.setTimeout(() => setEarlyFinish(false), 1120)

            if (revealDelayTimeout.current) window.clearTimeout(revealDelayTimeout.current)
            revealDelayTimeout.current = window.setTimeout(() => {
              const currentMain = document.querySelector<HTMLElement>('#root main')
              if (currentMain) decorateReveal(currentMain)
            }, 1030)
          } else {
            decorateReveal(main)
          }
        }
      }

      if (stage !== previousStage) {
        if (stage !== 'prepare') lastCountdown = ''
        if (stage !== 'question') lastTimer = ''
        if (stage !== 'reveal' && experience === 'presenter') clearPresenterRevealClock(main)
        previousStage = stage
      }
    }

    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(scan)
    }

    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('root') ?? document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      const main = document.querySelector<HTMLElement>('#root main')
      if (main) clearPresenterRevealClock(main)
      if (earlyFinishTimeout.current) window.clearTimeout(earlyFinishTimeout.current)
      if (revealDelayTimeout.current) window.clearTimeout(revealDelayTimeout.current)
    }
  }, [experience, pathname])

  if (!earlyFinish || (experience !== 'screen' && experience !== 'presenter')) return null

  return (
    <div
      className="m1-all-answered"
      aria-hidden="true"
      style={{
        animationDuration: '1.12s',
        background: 'radial-gradient(circle at center, rgba(7,25,54,.98), rgba(2,13,35,.97) 48%, rgba(2,13,35,.94) 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="m1-all-answered-ring"><span>✓</span></div>
      <div className="m1-all-answered-copy">
        <strong>Todos responderam</strong>
        <span>Vamos revelar a resposta</span>
      </div>
    </div>
  )
}
