import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { RetryableError } from '@/components/ui/RetryableError'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/contexts/ThemeContext'
import { saveAttempt, getDeviceFingerprint } from '@/lib/individualAttemptStorage'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']

type LoadState = 'loading' | 'network_error' | 'not_found' | 'not_open_yet' | 'closed' | 'ready'

export function JoinIndividualPage() {
  const { codigo } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [session, setSession] = useState<IndividualSession | null>(null)
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
      const { data, error } = await supabase
        .from('individual_sessions')
        .select('*')
        .eq('code', codigo!.toUpperCase())
        .maybeSingle()

      if (!active) return

      if (error) {
        setState('network_error')
        return
      }
      if (!data) {
        setState('not_found')
        return
      }
      setSession(data)

      const now = Date.now()
      if (data.status === 'closed' || (data.closes_at && new Date(data.closes_at).getTime() < now)) {
        setState('closed')
      } else if (data.status !== 'open' || (data.opens_at && new Date(data.opens_at).getTime() > now)) {
        setState('not_open_yet')
      } else {
        setState('ready')
      }
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
    if (!session) return
    if (session.require_identification && !displayName.trim()) {
      setError('Informe seu nome para participar.')
      return
    }
    setSubmitting(true)
    setError(null)

    const { data, error } = await supabase.rpc('start_individual_attempt', {
      p_session_id: session.id,
      p_display_name: displayName.trim() || 'Participante',
      p_team: team.trim() || null,
      p_device_fingerprint: getDeviceFingerprint(),
    })

    setSubmitting(false)
    if (error) {
      setError(traduzErro(error.message))
      return
    }

    const result = data as { attemptId: string; participantId: string }
    saveAttempt(session.id, {
      attemptId: result.attemptId,
      participantId: result.participantId,
      displayName: displayName.trim() || 'Participante',
    })
    navigate(`/individual/${session.id}/play`)
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
            message="Não foi possível carregar esta sessão. Verifique sua conexão."
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
          <h1 className="font-display text-xl font-bold mb-2">Desafio encerrado</h1>
          <p className="text-ink-muted">Esta sessão já foi encerrada. Confira o ranking com o organizador do evento.</p>
        </Card>
      </PublicShell>
    )
  }

  if (state === 'not_open_yet') {
    return (
      <PublicShell>
        <Card className="text-center">
          <h1 className="font-display text-xl font-bold mb-2">Ainda não começou</h1>
          <p className="text-ink-muted">Este desafio ainda não está aberto para participação. Aguarde o início.</p>
        </Card>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <Card>
        <h1 className="font-display text-2xl font-bold mb-1">{session?.name}</h1>
        <p className="text-ink-muted text-sm mb-6">{theme.welcomeMessage}</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label={session?.require_identification ? 'Seu nome' : 'Seu nome ou apelido (opcional)'} htmlFor="name">
            <Input
              id="name"
              autoFocus
              required={session?.require_identification}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Como você quer aparecer no ranking"
            />
          </Field>
          <Field label="Equipe ou área (opcional)" htmlFor="team">
            <Input id="team" value={team} onChange={(e) => setTeam(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="xl" disabled={submitting} className="mt-2">
            {submitting ? 'Preparando…' : 'Iniciar desafio'}
          </Button>
        </form>
      </Card>
    </PublicShell>
  )
}

function traduzErro(message: string): string {
  if (message.includes('já participou')) return 'Você já participou desta dinâmica.'
  if (message.includes('não está aberta')) return 'Esta sessão não está mais aberta.'
  return 'Não foi possível iniciar. Tente novamente.'
}
