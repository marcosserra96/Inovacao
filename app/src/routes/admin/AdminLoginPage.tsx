import { Navigate, useNavigate } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { AdminPasswordForm } from '@/components/admin/AdminPasswordForm'
import { useAuth } from '@/contexts/AuthContext'

export function AdminLoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  if (!loading && session) {
    return <Navigate to="/admin" replace />
  }

  return (
    <PublicShell>
      <Card>
        <h1 className="font-display text-2xl font-bold mb-1">Acesso administrativo</h1>
        <p className="text-ink-muted text-sm mb-6">Digite a senha para entrar.</p>
        <AdminPasswordForm onSuccess={() => navigate('/admin')} />
      </Card>
    </PublicShell>
  )
}
