import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

/**
 * Placeholder usado pelas rotas ainda não implementadas nesta fase do
 * projeto. Cada fase do plano (ver plano aprovado) substitui as páginas
 * correspondentes por sua implementação real.
 */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <PublicShell>
      <Card className="text-center">
        <Badge tone="accent" className="mb-4">
          {phase}
        </Badge>
        <h1 className="font-display text-2xl font-bold mb-2">{title}</h1>
        <p className="text-ink-muted">Esta tela será implementada nesta fase do projeto.</p>
      </Card>
    </PublicShell>
  )
}
