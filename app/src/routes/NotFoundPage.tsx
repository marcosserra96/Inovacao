import { Link } from 'react-router-dom'
import { PublicShell } from '@/components/layout/PublicShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <PublicShell>
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="text-center max-w-md w-full p-10 animate-scale-up border-border/50 shadow-lg">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center text-danger animate-pop">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
          </div>
          
          <h1 className="font-display text-4xl font-extrabold text-primary-dark mb-3">404</h1>
          <h2 className="font-display text-xl font-bold text-ink mb-2">Página não encontrada</h2>
          <p className="text-ink-muted mb-8 text-sm">
            O link que você acessou pode estar quebrado ou a página pode ter sido removida.
          </p>
          
          <Link to="/">
            <Button variant="primary" className="w-full h-12 text-base shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Voltar ao Início
            </Button>
          </Link>
        </Card>
      </div>
    </PublicShell>
  )
}
