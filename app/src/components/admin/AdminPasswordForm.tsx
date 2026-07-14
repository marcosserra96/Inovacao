import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'

export function AdminPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const { signIn } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    onSuccess()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Field label="Senha" htmlFor="admin-password">
        <Input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          autoFocus
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
  )
}
