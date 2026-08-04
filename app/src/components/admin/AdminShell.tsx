import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'

const navGroups = [
  {
    label: 'Dinâmica',
    items: [
      { to: '/admin', label: 'Visão geral', end: true, icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
      { to: '/admin/jogo', label: 'Controle da dinâmica', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    ],
  },
  {
    label: 'Conteúdo',
    items: [
      { to: '/admin/perguntas', label: 'Perguntas', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
      { to: '/admin/categorias', label: 'Categorias', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg> },
      { to: '/admin/conjuntos', label: 'Conjuntos', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
    ],
  },
  {
    label: 'Histórico',
    items: [
      { to: '/admin/sessoes', label: 'Sessões e partidas', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/admin/manutencao', label: 'Manutenção', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
      { to: '/admin/configuracoes', label: 'Configurações', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> },
      { to: '/admin/usuarios', label: 'Usuários', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    ],
  },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { name, role, signOut } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleSignOut() {
    // Navega antes de encerrar a sessão: assim que a sessão fica nula, o
    // ProtectedRoute da rota /admin atual redirecionaria sozinho para
    // /admin/login — sair da rota protegida primeiro evita essa corrida.
    navigate('/')
    await signOut()
  }

  return (
    <div className="min-h-svh flex flex-col lg:flex-row bg-bg">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between px-5 py-3 border-b border-border bg-surface shrink-0 shadow-sm z-20 relative">
        <div>
          <p className="font-display font-bold text-primary leading-tight">{theme.eventName}</p>
          <p className="text-xs text-ink-muted">Painel administrativo</p>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -mr-2 text-ink-muted hover:text-ink focus:outline-none"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen 
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
      </div>

      <aside className={clsx(
        "w-64 shrink-0 bg-surface shadow-lg shadow-ink/5 flex-col absolute lg:static inset-y-0 left-0 z-10 transform lg:transform-none transition-transform duration-200 ease-in-out flex lg:translate-x-0 mt-[61px] lg:mt-0 max-h-[calc(100svh-61px)] lg:max-h-none",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden lg:block px-5 py-5 border-b border-border">
          <p className="font-display font-bold text-primary leading-tight">{theme.eventName}</p>
          <p className="text-xs text-ink-muted">Painel administrativo</p>
        </div>
        
        <nav className="flex-1 flex flex-col p-3 overflow-y-auto">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="mb-4 last:mb-0">
              <p className="px-3.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted/70">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 rounded-r-xl rounded-l-sm border-l-3 px-3.5 py-2.5 text-sm font-medium transition-colors',
                        isActive 
                          ? 'border-primary bg-primary/8 text-primary' 
                          : 'border-transparent text-ink-muted hover:bg-ink/4 hover:text-ink',
                      )
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        
        <div className="p-4 border-t border-border mt-auto shrink-0 bg-surface">
          <p className="text-sm font-medium text-ink truncate">{name ?? 'Administrador'}</p>
          <p className="text-xs text-ink-muted mb-3 capitalize">{role === 'admin' ? 'Administrador' : 'Apresentador'}</p>
          <Button variant="ghost" size="md" className="w-full" onClick={handleSignOut}>
            Sair
          </Button>
        </div>
      </aside>
      
      {/* Overlay mobile */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-ink/20 z-0 lg:hidden mt-[61px]"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <main className="flex-1 min-w-0 overflow-y-auto bg-bg">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  )
}
