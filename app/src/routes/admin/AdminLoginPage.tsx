import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'

export function AdminLoginPage() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/admin" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate('/admin')
  }

  return (
    <PublicShell>
      <Card>
        <h1 className="font-display text-2xl font-bold mb-1">Painel administrativo</h1>
        <p className="text-ink-muted text-sm mb-6">Entre com sua conta de administrador ou apresentador.</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label="E-mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </PublicShell>
  )
}
