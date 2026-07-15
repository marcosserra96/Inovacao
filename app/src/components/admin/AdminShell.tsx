import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'

const navItems = [
  { to: '/admin', label: 'Visão geral', end: true },
  { to: '/admin/jogo', label: 'Controle da dinâmica' },
  { to: '/admin/perguntas', label: 'Perguntas' },
  { to: '/admin/categorias', label: 'Categorias' },
  { to: '/admin/conjuntos', label: 'Conjuntos' },
  { to: '/admin/sessoes', label: 'Sessões e partidas' },
  { to: '/admin/configuracoes', label: 'Configurações' },
  { to: '/admin/usuarios', label: 'Usuários' },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { name, role, signOut } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-svh flex bg-bg">
      <aside className="w-64 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <p className="font-display font-bold text-primary leading-tight">{theme.eventName}</p>
          <p className="text-xs text-ink-muted">Painel administrativo</p>
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-ink/5 hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-sm font-medium text-ink truncate">{name ?? 'Administrador'}</p>
          <p className="text-xs text-ink-muted mb-3 capitalize">{role === 'admin' ? 'Administrador' : 'Apresentador'}</p>
          <Button variant="ghost" size="md" className="w-full" onClick={handleSignOut}>
            Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
