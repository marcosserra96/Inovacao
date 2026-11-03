import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

export type QuizVisualTheme = {
  id: string
  name: string
  title: string
  subtitle: string
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  surfaceColor: string
  logoPrimary: string | null
  logoSecondary: string | null
}

export const DEFAULT_QUIZ_THEME: QuizVisualTheme = {
  id: '',
  name: 'Rota de Inovação',
  title: 'Rota de Inovação',
  subtitle: '',
  primaryColor: '#a7d52c',
  secondaryColor: '#00b6da',
  backgroundColor: '#020d23',
  surfaceColor: '#071936',
  logoPrimary: '/brand/energisa.png',
  logoSecondary: '/brand/enova.png',
}

const HEX = /^#[0-9a-f]{6}$/i
export function normalizeQuizTheme(value: unknown): QuizVisualTheme {
  if (!value || typeof value !== 'object') return DEFAULT_QUIZ_THEME
  const raw = value as Partial<QuizVisualTheme>
  const color = (v: unknown, fallback: string) => typeof v === 'string' && HEX.test(v) ? v : fallback
  const logo = (v: unknown) => typeof v === 'string' && (v.startsWith('/brand/') || /^data:image\/(png|jpeg|webp);base64,/.test(v)) ? v : null
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name : DEFAULT_QUIZ_THEME.name,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : DEFAULT_QUIZ_THEME.title,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    primaryColor: color(raw.primaryColor, DEFAULT_QUIZ_THEME.primaryColor),
    secondaryColor: color(raw.secondaryColor, DEFAULT_QUIZ_THEME.secondaryColor),
    backgroundColor: color(raw.backgroundColor, DEFAULT_QUIZ_THEME.backgroundColor),
    surfaceColor: color(raw.surfaceColor, DEFAULT_QUIZ_THEME.surfaceColor),
    logoPrimary: logo(raw.logoPrimary),
    logoSecondary: logo(raw.logoSecondary),
  }
}

export function themeStyle(theme: QuizVisualTheme): CSSProperties {
  return {
    '--quiz-primary': theme.primaryColor,
    '--quiz-secondary': theme.secondaryColor,
    '--quiz-bg': theme.backgroundColor,
    '--quiz-surface': theme.surfaceColor,
  } as CSSProperties
}

/** Cada partida lê seu tema congelado; no painel de preparação vale o tema selecionado. */
export function useQuizVisualTheme(sessionId?: string | null) {
  const [theme, setTheme] = useState<QuizVisualTheme>(DEFAULT_QUIZ_THEME)

  useEffect(() => {
    let active = true
    let running = false

    const load = async () => {
      if (running) return
      running = true
      try {
        if (sessionId) {
          const { data, error } = await supabase.from('live_quiz_sessions').select('*').eq('id', sessionId).maybeSingle()
          if (active && !error && data) {
            const snapshot = (data as any).visual_theme
            // Sessões antigas sem identidade própria usam a identidade atual.
            if (snapshot) setTheme(normalizeQuizTheme(snapshot))
            else {
              const {data:current} = await supabase.rpc('quiz_get_active_visual_theme' as never)
              if (active && current) setTheme(normalizeQuizTheme(current))
            }
          }
        } else {
          // A tela inicial é pública: live_quiz_defaults tem RLS apenas para apresentadores.
          const { data, error } = await supabase.rpc('quiz_get_active_visual_theme' as never)
          if (active && !error && data) setTheme(normalizeQuizTheme(data))
        }
      } finally { running = false }
    }

    const onThemeApplied = (event: Event) => {
      const custom = event as CustomEvent<QuizVisualTheme>
      if (!sessionId && custom.detail) setTheme(normalizeQuizTheme(custom.detail))
      void load()
    }
    const onFocus = () => void load()
    void load()
    const timer = window.setInterval(() => void load(), 2500)
    window.addEventListener('quiz-theme-applied', onThemeApplied)
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('quiz-theme-applied', onThemeApplied)
      window.removeEventListener('focus', onFocus)
    }
  }, [sessionId])
  return theme
}

export function themeFromRow(row: unknown): QuizVisualTheme {
  const r = row as Record<string, string | null>
  return normalizeQuizTheme({
    id:r.id, name:r.name, title:r.title, subtitle:r.subtitle,
    primaryColor:r.primary_color,secondaryColor:r.secondary_color,
    backgroundColor:r.background_color,surfaceColor:r.surface_color,
    logoPrimary:r.logo_primary,logoSecondary:r.logo_secondary,
  })
}
