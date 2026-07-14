import { Link } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { useTheme } from '@/contexts/ThemeContext'

const devLinks = [
  { to: '/j/DEMO', label: 'Entrar no desafio individual (dev)' },
  { to: '/duelo/entrar/DEMO', label: 'Entrar em um duelo (dev)' },
  { to: '/apresentador/nova', label: 'Painel do apresentador' },
  { to: '/admin/login', label: 'Painel administrativo' },
]

export function HomePage() {
  const { theme } = useTheme()

  return (
    <PublicShell>
      <Card className="text-center">
        <h1 className="font-display text-3xl font-bold mb-2 text-primary">{theme.eventName}</h1>
        <p className="text-ink-muted mb-6">{theme.welcomeMessage}</p>
        <nav className="flex flex-col gap-3 text-left">
          {devLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-ink hover:border-primary hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Card>
    </PublicShell>
  )
}
