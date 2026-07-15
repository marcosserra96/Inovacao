import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

export interface BrandTheme {
  eventName: string
  dynamicName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logoUrl: string | null
  backgroundUrl: string | null
  welcomeMessage: string
  resultMessage: string
}

export const DEFAULT_THEME: BrandTheme = {
  eventName: import.meta.env.VITE_DEFAULT_EVENT_NAME ?? 'Inovação EMR',
  dynamicName: 'Desafio Inovação EMR',
  primaryColor: '#0099cd',
  secondaryColor: '#26a3dd',
  accentColor: '#fb8200',
  logoUrl: null,
  backgroundUrl: null,
  welcomeMessage: 'A inovação também é uma forma de energia. Bora descobrir a sua?',
  resultMessage: 'Obrigado por participar! Confira sua posição no ranking.',
}

function fromRow(row: Database['public']['Tables']['event_settings']['Row']): BrandTheme {
  return {
    eventName: row.event_name,
    dynamicName: row.dynamic_name,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    logoUrl: row.logo_url,
    backgroundUrl: row.background_url,
    welcomeMessage: row.welcome_message,
    resultMessage: row.result_message,
  }
}

interface ThemeContextValue {
  theme: BrandTheme
  setTheme: (theme: BrandTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Aplica a identidade visual configurada no admin (tabela event_settings)
 * via CSS custom properties, para que TODAS as telas — participante,
 * telão, apresentador, não só o admin — reflitam a marca do evento. Busca
 * uma vez ao carregar e acompanha mudanças em tempo real, para que trocar
 * o nome/mensagens no meio do evento atualize quem já está com a tela
 * aberta sem precisar dar F5.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BrandTheme>(DEFAULT_THEME)

  useEffect(() => {
    let active = true

    supabase
      .from('event_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setTheme(fromRow(data))
      })

    const channel = supabase
      .channel('event_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_settings' }, (payload) => {
        if (payload.new) setTheme(fromRow(payload.new as Database['public']['Tables']['event_settings']['Row']))
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-primary', theme.primaryColor)
    root.style.setProperty('--color-secondary', theme.secondaryColor)
    root.style.setProperty('--color-accent', theme.accentColor)
    document.title = theme.eventName
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
