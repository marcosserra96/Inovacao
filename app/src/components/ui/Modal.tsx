import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-3xl bg-surface p-6 shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
