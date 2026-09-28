import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'

export function OpenQuizEntryPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function go() {
      const { data, error } = await supabase
        .from('individual_sessions')
        .select('code')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return
      if (error || !data) {
        setError('Nenhum quiz foi configurado ainda.')
        return
      }

      navigate(`/j/${data.code}`, { replace: true })
    }

    go()
    return () => {
      active = false
    }
  }, [navigate])

  return (
    <PublicShell>
      <Card className="text-center">
        {error ? (
          <>
            <div className="mx-auto mb-4 h-3 w-20 rounded-full" style={{ background: '#F37021' }} />
            <h1 className="font-display text-2xl font-extrabold" style={{ color: '#005061' }}>Quiz Energisa</h1>
            <p className="mt-3 text-ink-muted">{error}</p>
          </>
        ) : (
          <>
            <div className="flex justify-center" style={{ color: '#009FC2' }}><Spinner /></div>
            <p className="mt-4 text-sm text-ink-muted">Carregando o quiz…</p>
          </>
        )}
      </Card>
    </PublicShell>
  )
}
