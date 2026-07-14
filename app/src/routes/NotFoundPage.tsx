import { Link } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <PublicShell>
      <Card className="text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-ink-muted mb-6">Verifique o link ou código informado.</p>
        <Link to="/">
          <Button variant="ghost">Voltar ao início</Button>
        </Link>
      </Card>
    </PublicShell>
  )
}
