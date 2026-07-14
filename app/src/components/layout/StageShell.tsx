import type { ReactNode } from 'react'

/**
 * Layout para o telão: fundo escuro de alto contraste, sem elementos
 * administrativos, pensado para projeção em tela grande.
 */
export function StageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh w-full bg-stage-bg text-stage-ink overflow-hidden relative">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 15% 15%, var(--color-primary) 0%, transparent 45%), radial-gradient(circle at 85% 25%, var(--color-accent) 0%, transparent 40%), radial-gradient(circle at 80% 85%, var(--color-secondary) 0%, transparent 45%)',
        }}
      />
      <div className="relative z-10 flex min-h-svh flex-col p-10">{children}</div>
    </div>
  )
}
