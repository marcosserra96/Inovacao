import type { ReactNode } from 'react'

export function StageShell({ children }: { children: ReactNode }) {
  return (
    <div className="stage-gradient min-h-svh w-full bg-stage-bg text-stage-ink overflow-hidden relative">
      <div className="relative z-10 flex min-h-svh flex-col p-8 lg:p-12">{children}</div>
    </div>
  )
}
