import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { RetryableError } from '@/components/ui/RetryableError'
import { SparkBadge } from '@/components/ui/SparkBadge'
import { AdminAccessButton } from '@/components/admin/AdminAccessButton'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'
import { saveLiveQuizParticipant, getLiveQuizDeviceFingerprint } from '@/lib/liveQuizStorage'
import type { Database } from '@/types/database.types'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']

type LoadState = 'loading' | 'network_error' | 'not_found' | 'closed' | 'ready'

/**
 * Entrada do quiz coletivo — nome + equipe (opcional), como no modo
 * individual, mas ao confirmar entra num lobby ao vivo em vez de começar a
 * jogar sozinho: quem já entrou antes (mesmo device_fingerprint) tem a
 * participação restaurada automaticamente em vez de duplicada.
 */
export function LiveQuizJoinPage() {
  const { codigo } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [session, setSession] = useState<LiveQuizSession | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [displayName, setDisplayName] = useState('')
  const [team, setTeam] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (!codigo) return
    let active = true
    setState('loading')

    async function load() {
      const { data, error: fetchError } = await supabase
        .from('live_quiz_sessions')
        .select('*')
        .eq('code', codigo!.toUpperCase())
        .maybeSingle()

      if (!active) return
      if (fetchError) {
        setState('network_error')
        return
      }
      if (!data) {
        setState('not_found')
        return
      }
      setSession(data)
      setState(data.status === 'finished' || data.status === 'cancelled' ? 'closed' : 'ready')
    }
    load().catch(() => {
      if (active) setState('network_error')
    })
    return () => {
      active = false
    }
  }, [codigo, retryTick])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Informe seu nome para participar.')
      return
    }
    setSubmitting(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('join_live_quiz', {
      p_code: codigo ?? '',
      p_display_name: displayName.trim(),
      p_team: team.trim() || null,
      p_device_fingerprint: getLiveQuizDeviceFingerprint(),
    })

    setSubmitting(false)
    if (rpcError || !data) {
      setError(traduzErro(rpcError?.message))
      return
    }

    const result = data as unknown as { sessionId: string; participantId: string; joinToken: string }
    saveLiveQuizParticipant(result.sessionId, { participantId: result.participantId, joinToken: result.joinToken })
    navigate(`/quiz/${result.sessionId}/jogar/${result.participantId}`)
  }

  if (state === 'loading') {
    return (
      <PublicShell>
        <div className="flex justify-center text-primary">
          <Spinner />
        </div>
      </PublicShell>
    )
  }

  if (state === 'network_error') {
    return (
      <PublicShell>
        <Card>
          <RetryableError
            message="Não foi possível carregar este quiz. Verifique sua conexão."
            onRetry={() => setRetryTick((n) => n + 1)}
          />
        </Card>
      </PublicShell>
    )
  }

  if (state === 'not_found') {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Código não encontrado</h1>
          <p className="text-ink-muted">Verifique o link ou código informado e tente novamente.</p>
        </Card>
      </PublicShell>
    )
  }

  if (state === 'closed') {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Quiz encerrado</h1>
          <p className="text-ink-muted">Este quiz coletivo já foi encerrado.</p>
        </Card>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <Card>
        <SparkBadge className="mb-4 h-16 w-16" />
        <h1 className="font-display text-2xl font-extrabold mb-1 text-center text-primary-dark">{session?.name}</h1>
        <p className="text-ink-muted text-sm mb-6 text-center">{theme.welcomeMessage}</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label="Seu nome" htmlFor="name">
            <Input
              id="name"
              autoFocus
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Como você quer aparecer no telão"
            />
          </Field>
          <Field label="Equipe ou área (opcional)" htmlFor="team">
            <Input id="team" value={team} onChange={(e) => setTeam(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="xl" disabled={submitting} className="mt-2">
            {submitting ? 'Entrando…' : 'Entrar no quiz'}
          </Button>
        </form>
      </Card>
      <AdminAccessButton />
    </PublicShell>
  )
}

function traduzErro(message?: string): string {
  if (!message) return 'Não foi possível entrar. Tente novamente.'
  if (message.includes('inválido')) return 'Código inválido.'
  if (message.includes('não está aceitando')) return 'Este quiz não está mais aceitando novas entradas.'
  if (message.includes('já foi encerrado')) return 'Este quiz já foi encerrado.'
  return 'Não foi possível entrar. Tente novamente.'
}
