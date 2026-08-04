import { Navigate, useNavigate } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
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
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <Card className="w-full max-w-md p-8 animate-fade-up shadow-xl border-border/50 bg-surface">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Badge tone="primary" className="px-3 py-1 bg-primary/10 text-primary border-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Acesso Restrito
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-extrabold text-primary-dark mb-2">Administração</h1>
            <p className="text-ink-muted text-sm">Digite a senha para acessar o painel de controle.</p>
          </div>
          
          <div className="bg-bg rounded-lg p-6 border border-border">
            <AdminPasswordForm onSuccess={() => navigate('/admin')} />
          </div>
        </Card>
      </div>
    </PublicShell>
  )
}
