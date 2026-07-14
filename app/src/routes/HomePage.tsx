import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { SparkBadge } from '@/components/ui/SparkBadge'
import { AdminAccessButton } from '@/components/admin/AdminAccessButton'
import { useTheme } from '@/contexts/ThemeContext'

export function HomePage() {
  const { theme } = useTheme()

  return (
    <PublicShell>
      <Card className="text-center">
        <SparkBadge className="mb-5" />
        <h1 className="font-display text-3xl font-extrabold mb-2 text-primary-dark leading-tight">
          {theme.eventName}
        </h1>
        <p className="text-ink-muted">{theme.welcomeMessage}</p>
      </Card>
      <AdminAccessButton />
    </PublicShell>
  )
}
