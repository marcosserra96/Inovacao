import { isSupabaseConfigured } from '@/lib/supabase'

export function ConfigWarningBanner() {
  if (isSupabaseConfigured) return null

  return (
    <div className="bg-accent text-white text-sm text-center py-2 px-4 relative z-40">
      Supabase não configurado — copie <code className="font-mono">.env.example</code> para{' '}
      <code className="font-mono">.env</code> e preencha com os dados do seu projeto. Login, dados e tempo real não
      funcionarão até lá.
    </div>
  )
}
