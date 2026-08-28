import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'

type Experience = 'screen' | 'presenter' | 'participant' | null

type Stage =
  | 'idle'
  | 'lobby'
  | 'prepare'
  | 'question'
  | 'reveal'
  | 'ranking'
  | 'quiz-result'
  | 'semifinal-prepare'
  | 'semifinal-question'
  | 'semifinal-reveal'
  | 'semifinal-result'
  | 'final-prepare'
  | 'final-question'
  | 'final-reveal'
  | 'champion'
  | 'paused'
  | 'finished'

function getExperience(pathname: string): Experience {
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

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR')
}

function detectStage(textValue: string): Stage {
  const text = normalizeText(textValue)

  if (text.includes('dinâmica finalizada') || text.includes('sessão finalizada')) return 'finished'
  if (text.includes('jogo pausado') || text.includes('aguardando retomada')) return 'paused'
  if (text.includes('você venceu') || text.includes('temos um campeão') || text.includes('campeão da rota')) return 'champion'

  if (text.includes('grande final') && text.includes('prepare-se')) return 'final-prepare'
  if (text.includes('grande final') && (text.includes('mandou bem') || text.includes('quase') || text.includes('resposta revelada') || text.includes('resposta correta'))) return 'final-reveal'
  if (text.includes('grande final') && (text.includes('rodada') || text.includes('tempo restante') || text.includes(' × '))) return 'final-question'

  if (text.includes('semifinal') && text.includes('prepare-se')) return 'semifinal-prepare'
  if (text.includes('semifinal') && (text.includes('mandou bem') || text.includes('quase') || text.includes('resposta revelada') || text.includes('resposta correta'))) return 'semifinal-reveal'
  if (text.includes('finalistas definidos') || text.includes('semifinais concluídas') || text.includes('você está na final')) return 'semifinal-result'
  if (text.includes('semifinal') && (text.includes('rodada') || text.includes('tempo restante') || text.includes(' × '))) return 'semifinal-question'

  if (text.includes('top 4 das semifinais') || text.includes('top 4 definido') || text.includes('você está na semifinal')) return 'quiz-result'
  if (text.includes('ranking parcial')) return 'ranking'
  if (text.includes('resposta correta') || text.includes('resposta revelada') || text.includes('mandou bem') || text.includes('quase')) return 'reveal'
  if (text.includes('prepare-se') || text.includes('próxima pergunta')) return 'prepare'
  if (text.includes('quiz coletivo') && (text.includes('pergunta') || text.includes('tempo restante'))) return 'question'
  if (text.includes('aguardando participantes') || text.includes('você está dentro') || text.includes('pronto para começar')) return 'lobby'

  return 'idle'
}

function getStageNode(main: HTMLElement) {
  const header = main.querySelector('header')
  if (header?.parentElement) {
    const siblings = Array.from(header.parentElement.children)
    const index = siblings.indexOf(header)
    const next = siblings.slice(index + 1).find((item) => item instanceof HTMLElement)
    if (next instanceof HTMLElement) return next
  }
  const section = main.querySelector('section')
  return section instanceof HTMLElement ? section : main
}

function restartClass(element: HTMLElement, className: string) {
  element.classList.remove(className)
  void element.offsetWidth
  element.classList.add(className)
}

function questionSignature(main: HTMLElement) {
  const headings = Array.from(main.querySelectorAll('h1'))
    .map((item) => normalizeText(item.textContent ?? ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  return headings[0] ?? ''
}

function decorateOptions(main: HTMLElement) {
  const candidates = Array.from(main.querySelectorAll<HTMLElement>('button, div')).filter((element) => {
    if (element.children.length < 2 || element.children.length > 5) return false
    const first = normalizeText(element.firstElementChild?.textContent ?? '').toUpperCase()
    if (!/^[A-F]$/.test(first)) return false
    return (element.textContent?.length ?? 0) < 700
  })

  candidates.slice(0, 6).forEach((element, index) => {
    element.style.setProperty('--motion-index', String(index))
    restartClass(element, 'motion-option-in')
  })
}

function decorateRanking(main: HTMLElement) {
  const candidates = Array.from(main.querySelectorAll<HTMLElement>('div')).filter((element) => {
    if (element.children.length < 2 || element.children.length > 5) return false
    const first = normalizeText(element.firstElementChild?.textContent ?? '')
    return /^([1-9]|10)º?$/.test(first)
  })

  candidates.slice(0, 10).forEach((element, index) => {
    element.style.setProperty('--motion-index', String(index))
    restartClass(element, 'motion-rank-in')
  })
}

function decoratePressables(main: HTMLElement) {
  main.querySelectorAll<HTMLElement>('button').forEach((button) => button.classList.add('motion-pressable'))
}

function findLargestNumber(main: HTMLElement) {
  const leaves = Array.from(main.querySelectorAll<HTMLElement>('div, span'))
    .filter((element) => element.children.length === 0 && /^\d{1,2}$/.test((element.textContent ?? '').trim()))
    .map((element) => ({ element, size: Number.parseFloat(window.getComputedStyle(element).fontSize) || 0 }))
    .sort((a, b) => b.size - a.size)
  return leaves[0]?.element ?? null
}

function pulseCountdown(main: HTMLElement, stage: Stage, lastValue: string) {
  if (!stage.includes('prepare') && !stage.includes('question')) return lastValue
  const number = findLargestNumber(main)
  if (!number) return lastValue
  const value = (number.textContent ?? '').trim()
  if (!value || value === lastValue) return lastValue

  if (stage.includes('prepare')) restartClass(number, 'motion-count-hit')
  else if (Number(value) <= 5) restartClass(number, 'motion-urgent-hit')
  return value
}

function decorateAnswerFeedback(main: HTMLElement) {
  if (!normalizeText(main.innerText).includes('resposta registrada')) return

  main.querySelectorAll<HTMLElement>('button').forEach((button) => {
    if (button.className.includes('border-[#a7d52c]')) button.classList.add('motion-answer-lock')
  })

  Array.from(main.querySelectorAll<HTMLElement>('div')).forEach((element) => {
    if (normalizeText(element.textContent ?? '') === 'resposta registrada') element.classList.add('motion-answer-confirm')
  })
}

const CONFETTI = Array.from({ length: 34 }, (_, index) => ({
  left: `${(index * 29 + 7) % 100}%`,
  delay: `${((index * 17) % 24) / 10}s`,
  duration: `${2.8 + ((index * 13) % 18) / 10}s`,
  rotation: `${(index * 47) % 180}deg`,
  size: 5 + ((index * 7) % 8),
}))

export function MotionOrchestrator() {
  const { pathname } = useLocation()
  const experience = useMemo(() => getExperience(pathname), [pathname])
  const [stage, setStage] = useState<Stage>('idle')

  useEffect(() => {
    if (!experience) {
      document.body.removeAttribute('data-live-experience')
      setStage('idle')
      return
    }

    document.body.dataset.liveExperience = experience
    let lastStage: Stage = 'idle'
    let lastQuestion = ''
    let lastCountdown = ''
    let frame = 0

    const scan = () => {
      const main = document.querySelector<HTMLElement>('#root main')
      if (!main) return

      main.dataset.motionSurface = experience
      const text = main.innerText ?? ''
      const nextStage = detectStage(text)
      const nextQuestion = nextStage.includes('question') ? questionSignature(main) : ''
      const stageChanged = nextStage !== lastStage
      const questionChanged = Boolean(nextQuestion && nextQuestion !== lastQuestion)

      const header = main.querySelector<HTMLElement>('header')
      if (header && !header.classList.contains('motion-brand-in')) header.classList.add('motion-brand-in')
      decoratePressables(main)

      if (stageChanged || questionChanged) {
        const stageNode = getStageNode(main)
        stageNode.dataset.motionStage = nextStage
        restartClass(stageNode, 'motion-stage-enter')

        if (nextStage.includes('question')) decorateOptions(main)
        if (nextStage === 'ranking' || nextStage.includes('result')) decorateRanking(main)

        lastStage = nextStage
        lastQuestion = nextQuestion
        lastCountdown = ''
        setStage(nextStage)
      }

      lastCountdown = pulseCountdown(main, nextStage, lastCountdown)
      if (experience === 'participant') decorateAnswerFeedback(main)
    }

    const scheduleScan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(scan)
    }

    scheduleScan()
    const observer = new MutationObserver(scheduleScan)
    observer.observe(document.getElementById('root') ?? document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      document.body.removeAttribute('data-live-experience')
    }
  }, [experience, pathname])

  if (!experience || stage !== 'champion') return null

  return (
    <div className="motion-celebration" aria-hidden="true">
      <div className="motion-champion-halo" />
      {CONFETTI.map((piece, index) => (
        <span
          key={index}
          className={`motion-confetti motion-confetti-${index % 3}`}
          style={{
            left: piece.left,
            width: piece.size,
            height: Math.max(4, piece.size * 0.52),
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            '--motion-rotation': piece.rotation,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}
