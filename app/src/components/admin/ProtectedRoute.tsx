import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/Spinner'

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { session, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center text-primary">
        <Spinner />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  if (requireAdmin && role !== 'admin') {
    return (
      <div className="min-h-svh flex items-center justify-center px-6 text-center">
        <p className="text-ink-muted">Esta área é restrita a administradores.</p>
      </div>
    )
  }

  return <>{children}</>
}
