/**
 * Três pontos pulsando em sequência — usado nas telas de espera (sala de
 * espera, aguardando início) para deixar claro que a tela está viva, não
 * travada, enquanto não há nada mais para mostrar.
 */
export function WaitingDots({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-primary/60 animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  )
}
