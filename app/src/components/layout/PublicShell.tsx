import type { ReactNode } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Layout usado pelas telas do participante: mobile-first, centralizado,
 * área de toque generosa. Também serve como base para telas de entrada.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const { theme } = useTheme()

  return (
    <div className="min-h-svh flex flex-col bg-bg">
      <header className="flex items-center justify-center gap-2 py-4">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={theme.eventName} className="h-8" />
        ) : (
          <span className="font-display text-lg font-bold text-primary">{theme.eventName}</span>
        )}
      </header>
      <main className="flex-1 flex flex-col items-stretch justify-center mx-auto w-full max-w-md px-5 py-6">
        {children}
      </main>
    </div>
  )
}
