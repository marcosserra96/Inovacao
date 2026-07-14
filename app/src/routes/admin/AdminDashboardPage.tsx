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
    { label: 'Perguntas ativas', value: counts?.questions, to: '/admin/perguntas' },
    { label: 'Conjuntos de perguntas', value: counts?.questionSets, to: '/admin/conjuntos' },
    { label: 'Sessões individuais abertas', value: counts?.openSessions, to: '/admin/sessoes' },
    { label: 'Duelos em andamento', value: counts?.activeMatches, to: '/admin/sessoes' },
  ]

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold mb-1">Visão geral</h1>
      <p className="text-ink-muted mb-6">Resumo rápido do estado atual da plataforma.</p>

      {error && (
        <Card className="mb-6 border-danger/30 bg-danger/5">
          <p className="text-sm text-danger">Não foi possível carregar os números: {error}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to}>
            <Card className="hover:border-primary transition-colors">
              <p className="text-sm text-ink-muted mb-1">{tile.label}</p>
              <p className="font-display text-3xl font-bold text-primary">
                {tile.value === undefined ? '—' : tile.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </AdminShell>
  )
}
