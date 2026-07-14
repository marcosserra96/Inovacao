import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { AdminAccessButton } from '@/components/admin/AdminAccessButton'
import { useTheme } from '@/contexts/ThemeContext'

export function HomePage() {
  const { theme } = useTheme()

  return (
    <PublicShell>
      <Card className="text-center">
        <h1 className="font-display text-3xl font-bold mb-2 text-primary">{theme.eventName}</h1>
        <p className="text-ink-muted">{theme.welcomeMessage}</p>
      </Card>
      <AdminAccessButton />
    </PublicShell>
  )
}
