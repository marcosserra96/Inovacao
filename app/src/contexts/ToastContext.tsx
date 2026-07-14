import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import clsx from 'clsx'

interface Toast {
  id: number
  message: string
  tone: 'success' | 'error'
}

const ToastContext = createContext<((message: string, tone?: Toast['tone']) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
              t.tone === 'success' ? 'bg-success' : 'bg-danger',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}
