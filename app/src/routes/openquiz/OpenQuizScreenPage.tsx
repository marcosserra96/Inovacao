import { useEffect, useMemo, useState } from 'react'
import { QrCode } from '@/components/ui/QrCode'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type Ranking = Database['public']['Views']['v_individual_ranking']['Row']

const medals = ['🥇', '🥈', '🥉']

export function OpenQuizScreenPage() {
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [ranking, setRanking] = useState<Ranking[]>([])
  const [loading, setLoading] = useState(true)

  const joinUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/participar`
  }, [])

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const { data: latest } = await supabase
        .from('individual_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      setSession(latest ?? null)

      if (!latest) {
        setRanking([])
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('v_individual_ranking')
        .select('*')
        .eq('session_id', latest.id)
        .order('rank')
        .limit(latest.ranking_size || 10)

      if (!cancelled) {
        setRanking(data ?? [])
        setLoading(false)
      }
    }

    refresh()
    const timer = setInterval(refresh, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const accepting = session?.status === 'open'

  return (
    <div className="min-h-screen text-white" style={{ background: 'radial-gradient(circle at 15% 20%, rgba(0,159,194,.28), transparent 34%), radial-gradient(circle at 85% 80%, rgba(243,112,33,.18), transparent 28%), #052F38' }}>
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-8 py-7">
        <header className="mb-6 flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.32em]" style={{ color: '#7DDBEA' }}>Quiz Energisa</p>
            <h1 className="mt-1 font-display text-4xl font-extrabold">{session?.name ?? 'Quiz aberto'}</h1>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-sm font-bold">
            <span className={accepting ? 'text-emerald-300' : 'text-orange-300'}>
              {accepting ? '● Respostas abertas' : '● Respostas encerradas'}
            </span>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-[420px_1fr] gap-8">
          <section className="flex flex-col justify-between rounded-[32px] border border-white/10 bg-white/[0.07] p-8 shadow-2xl">
            <div>
              <div className="mb-5 inline-flex rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: '#F37021' }}>
                Participe pelo celular
              </div>
              <h2 className="font-display text-3xl font-extrabold leading-tight">Aponte a câmera para o QR Code</h2>
              <p className="mt-3 text-lg text-white/65">O código é permanente. Você pode entrar por ele sempre que uma rodada estiver disponível.</p>
            </div>

            <div className="my-8 flex justify-center rounded-[28px] bg-white p-6">
              {joinUrl && <QrCode value={joinUrl} size={250} />}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 px-5 py-4 text-center">
              <p className="text-sm text-white/50">Acesso direto</p>
              <p className="mt-1 break-all text-lg font-bold">{joinUrl}</p>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.07] p-8 shadow-2xl">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.24em]" style={{ color: '#7DDBEA' }}>Tempo real</p>
                <h2 className="font-display text-3xl font-extrabold">Ranking</h2>
              </div>
              <p className="text-sm text-white/50">Atualização automática</p>
            </div>

            {loading ? (
              <p className="text-white/60">Carregando ranking…</p>
            ) : ranking.length === 0 ? (
              <div className="flex h-[65vh] items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.03] text-center">
                <div>
                  <p className="font-display text-3xl font-extrabold">Aguardando participantes</p>
                  <p className="mt-2 text-lg text-white/55">O ranking aparece aqui assim que as primeiras respostas forem concluídas.</p>
                </div>
              </div>
            ) : (
              <ol className="space-y-3">
                {ranking.map((row, index) => (
                  <li
                    key={row.participant_id}
                    className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4"
                    style={{ transform: index < 3 ? 'scale(1.01)' : undefined }}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-black" style={{ background: index === 0 ? '#F37021' : index === 1 ? '#009FC2' : index === 2 ? '#2BB4C9' : 'rgba(255,255,255,.08)' }}>
                      {index < 3 ? medals[index] : row.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xl font-bold">{row.display_name}</p>
                      {row.team && <p className="truncate text-sm text-white/50">{row.team}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-extrabold">{row.total_score}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">pontos</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
