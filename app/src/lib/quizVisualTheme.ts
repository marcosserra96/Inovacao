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
    const load = async () => {
      if (sessionId) {
        const { data } = await supabase.from('live_quiz_sessions').select('*').eq('id', sessionId).maybeSingle()
        if (active && (data as any)?.visual_theme) setTheme(normalizeQuizTheme((data as any).visual_theme))
      } else {
        const { data: defaults } = await supabase.from('live_quiz_defaults').select('*').eq('id', true).maybeSingle()
        if (!(defaults as any)?.visual_theme_id) return
        const { data } = await supabase.from('quiz_visual_themes' as never).select('*').eq('id', (defaults as any).visual_theme_id).maybeSingle()
        if (active && data) setTheme(themeFromRow(data))
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 2500)
    return () => { active = false; window.clearInterval(timer) }
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
