import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { SparkBadge } from '@/components/ui/SparkBadge'
import { supabase } from '@/lib/supabase'
import { saveDuelPlayer } from '@/lib/duelPlayerStorage'

export function DuelJoinPage() {
  const { codigo } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Digite seu nome para entrar no duelo.')
      return
    }
    setSubmitting(true)
    setError(null)

    const { data, error } = await supabase.rpc('join_duel_match', {
      p_code: codigo ?? '',
      p_display_name: displayName.trim(),
    })

    setSubmitting(false)
    if (error || !data) {
      setError(traduzErro(error?.message))
      return
    }

    const result = data as unknown as { matchId: string; playerId: string; joinToken: string }
    saveDuelPlayer(result.matchId, { playerId: result.playerId, joinToken: result.joinToken })
    navigate(`/duelo/${result.matchId}/jogar/${result.playerId}`)
  }

  return (
    <PublicShell>
      <Card>
        <SparkBadge icon="bolt" className="mb-4 h-16 w-16" />
        <h1 className="font-display text-2xl font-extrabold mb-1 text-center text-primary-dark">Duelo ao vivo</h1>
        <p className="text-ink-muted text-sm mb-6 text-center">Digite seu nome e aguarde o apresentador iniciar a partida.</p>
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
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="xl" disabled={submitting} className="mt-2">
            {submitting ? 'Entrando…' : 'Entrar no duelo'}
          </Button>
        </form>
      </Card>
    </PublicShell>
  )
}

function traduzErro(message?: string): string {
  if (!message) return 'Não foi possível entrar. Tente novamente.'
  if (message.includes('inválido')) return 'Código de partida inválido.'
  if (message.includes('não está aceitando')) return 'Esta partida não está mais aceitando participantes.'
  if (message.includes('já foi encerrada')) return 'Esta partida já foi encerrada.'
  return 'Não foi possível entrar. Tente novamente.'
}
