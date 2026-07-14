import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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
  eventName: import.meta.env.VITE_DEFAULT_EVENT_NAME ?? 'Dinâmica de Inovação',
  dynamicName: 'Desafio da Inovação',
  primaryColor: '#0099cd',
  secondaryColor: '#26a3dd',
  accentColor: '#fb8200',
  logoUrl: null,
  backgroundUrl: null,
  welcomeMessage: 'Prepare-se para testar o quanto você pensa fora da caixa.',
  resultMessage: 'Obrigado por participar! Confira sua posição no ranking.',
}

interface ThemeContextValue {
  theme: BrandTheme
  setTheme: (theme: BrandTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Aplica a identidade visual configurada no admin via CSS custom properties,
 * para que todo o app (participante, telão, apresentador) reflita a marca
 * do evento sem precisar recompilar nada.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BrandTheme>(DEFAULT_THEME)

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
