import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { SparkBadge } from '@/components/ui/SparkBadge'
import { Spinner } from '@/components/ui/Spinner'
import { RetryableError } from '@/components/ui/RetryableError'
import { AdminAccessButton } from '@/components/admin/AdminAccessButton'
import { WaitingDots } from '@/components/ui/WaitingDots'
import { useTheme } from '@/contexts/ThemeContext'
import { useGameControl } from '@/hooks/useGameControl'
import { supabase } from '@/lib/supabase'

/**
 * Ponto de entrada único dos participantes (o link/QR Code impresso no
 * evento). Verifica qual é o jogo ativo (definido pelo admin em
 * /admin/jogo) e leva a pessoa direto para lá — ninguém precisa saber ou
 * digitar um código específico.
 */
export function HomePage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { control, loading, error, retry } = useGameControl()
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    if (!control) return

    async function redirect() {
      if (control!.active_mode === 'individual' && control!.active_individual_session_id) {
        setRedirecting(true)
        const { data } = await supabase
          .from('individual_sessions')
          .select('code')
          .eq('id', control!.active_individual_session_id)
          .maybeSingle()
        if (data?.code) {
          navigate(`/j/${data.code}`, { replace: true })
          return
        }
        setRedirecting(false)
      } else if (control!.active_mode === 'duel' && control!.active_duel_match_id) {
        setRedirecting(true)
        const { data } = await supabase
          .from('duel_matches')
          .select('code')
          .eq('id', control!.active_duel_match_id)
          .maybeSingle()
        if (data?.code) {
          navigate(`/duelo/entrar/${data.code}`, { replace: true })
          return
        }
        setRedirecting(false)
      }
    }
    redirect()
  }, [control, navigate])

  if (loading || redirecting) {
    return (
      <PublicShell>
        <div className="flex justify-center text-primary">
          <Spinner />
        </div>
      </PublicShell>
    )
  }

  if (error) {
    return (
      <PublicShell>
        <Card>
          <RetryableError message={error} onRetry={retry} />
        </Card>
        <AdminAccessButton />
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <Card className="text-center">
        <SparkBadge className="mb-5" />
        <h1 className="font-display text-3xl font-extrabold mb-2 text-primary-dark leading-tight">
          {theme.eventName}
        </h1>
        <p className="text-ink-muted">{theme.welcomeMessage}</p>
        <p className="text-ink-muted text-sm mt-4 mb-4">Aguarde o início da dinâmica.</p>
        <WaitingDots className="justify-center" />
      </Card>
      <AdminAccessButton />
    </PublicShell>
  )
}
