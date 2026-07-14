import { useEffect, useState } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import type { AdminRole, Database } from '@/types/database.types'

type AdminProfile = Database['public']['Tables']['admin_profiles']['Row']

export function AdminUsersPage() {
  const notify = useToast()
  const { session } = useAuth()
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('admin_profiles').select('*').order('created_at')
    if (error) notify(error.message, 'error')
    setProfiles(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleRoleChange(userId: string, role: AdminRole) {
    const { error } = await supabase.from('admin_profiles').update({ role }).eq('user_id', userId)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Papel atualizado.')
    load()
  }

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-bold mb-1">Usuários administrativos</h1>
      <p className="text-ink-muted mb-2">Quem pode acessar o painel administrativo e o painel do apresentador.</p>
      <p className="text-sm text-ink-muted mb-6">
        Para criar um novo usuário, cadastre-o em Authentication no painel do Supabase (ou habilite o autocadastro) e
        depois promova-o aqui.
      </p>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-ink-muted text-sm">Carregando…</p>
        ) : (
          <ul className="divide-y divide-border">
            {profiles.map((p) => (
              <li key={p.user_id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex-1 text-ink">{p.name}</span>
                {p.user_id === session?.user.id && <Badge tone="primary">Você</Badge>}
                <Select
                  className="max-w-[180px]"
                  value={p.role}
                  onChange={(e) => handleRoleChange(p.user_id, e.target.value as AdminRole)}
                >
                  <option value="presenter">Apresentador</option>
                  <option value="admin">Administrador</option>
                </Select>
              </li>
            ))}
            {profiles.length === 0 && <li className="px-5 py-3.5 text-sm text-ink-muted">Nenhum usuário ainda.</li>}
          </ul>
        )}
      </Card>
    </AdminShell>
  )
}
