import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'

interface Counts {
  questions: number
  questionSets: number
  openSessions: number
  activeMatches: number
}

export function AdminDashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      const [questions, questionSets, openSessions, activeMatches] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('question_sets').select('id', { count: 'exact', head: true }),
        supabase.from('individual_sessions').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('duel_matches').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      ])
      const firstError = questions.error ?? questionSets.error ?? openSessions.error ?? activeMatches.error
      if (!active) return
      if (firstError) {
        setError(firstError.message)
        return
      }
      setCounts({
        questions: questions.count ?? 0,
        questionSets: questionSets.count ?? 0,
        openSessions: openSessions.count ?? 0,
        activeMatches: activeMatches.count ?? 0,
      })
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const tiles = [
    { 
      label: 'Perguntas ativas', 
      value: counts?.questions, 
      to: '/admin/perguntas',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
      color: 'bg-primary/10'
    },
    { 
      label: 'Conjuntos de perguntas', 
      value: counts?.questionSets, 
      to: '/admin/conjuntos',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      color: 'bg-secondary/10'
    },
    { 
      label: 'Sessões abertas', 
      value: counts?.openSessions, 
      to: '/admin/sessoes',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: 'bg-success/10'
    },
    { 
      label: 'Duelos em andamento', 
      value: counts?.activeMatches, 
      to: '/admin/sessoes',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      color: 'bg-accent/10'
    },
  ]

  const quickActions = [
    { label: 'Nova Pergunta', to: '/admin/perguntas/nova', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg> },
    { label: 'Novo Conjunto', to: '/admin/conjuntos/novo', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { label: 'Painel do Apresentador', to: '/apresentador', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
    { label: 'Configurações', to: '/admin/configuracoes', icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> },
  ]

  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-extrabold text-primary-dark mb-2">Visão geral</h1>
        <p className="text-ink-muted">Resumo rápido do estado atual da plataforma.</p>
      </div>

      {error && (
        <Card className="mb-8 border-danger/30 bg-danger/5">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-sm text-danger font-medium">Não foi possível carregar os números: {error}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="block group">
            <Card className="h-full flex flex-col p-6 hover:border-primary hover:shadow-md transition-all duration-200 animate-fade-up">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${tile.color} group-hover:scale-110 transition-transform`}>
                  {tile.icon}
                </div>
                <p className="text-sm font-medium text-ink-muted leading-tight">{tile.label}</p>
              </div>
              <div className="mt-auto">
                <p className="font-display text-4xl font-extrabold text-primary-dark">
                  {tile.value === undefined ? (
                    <span className="opacity-30 animate-pulse">—</span>
                  ) : (
                    tile.value
                  )}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
        <h2 className="font-display text-lg font-bold text-primary-dark mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <Link key={i} to={action.to} className="block">
              <Card className="flex items-center gap-3 p-4 hover:border-accent hover:bg-accent/5 transition-colors group cursor-pointer">
                <div className="text-ink-muted group-hover:text-accent transition-colors">
                  {action.icon}
                </div>
                <span className="font-medium text-ink group-hover:text-primary-dark transition-colors">{action.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
