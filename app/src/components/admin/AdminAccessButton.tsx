import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { AdminPasswordForm } from '@/components/admin/AdminPasswordForm'

/**
 * Ícone discreto no canto da tela, usado pelo organizador do evento para
 * acessar o painel administrativo sem expor um link/botão visível aos
 * participantes. Não deve aparecer no telão nem nas telas de jogo.
 */
export function AdminAccessButton() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Acesso administrativo"
        className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink-muted shadow-md border border-border hover:text-primary hover:border-primary transition-colors"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
          />
          <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Acesso administrativo">
        <AdminPasswordForm
          onSuccess={() => {
            setOpen(false)
            navigate('/admin')
          }}
        />
      </Modal>
    </>
  )
}
