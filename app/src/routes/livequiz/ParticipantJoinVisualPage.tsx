import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getLiveQuizDeviceFingerprint, saveLiveQuizParticipant } from '@/lib/liveQuizStorage'
import type { Database } from '@/types/database.types'

type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type LoadState = 'loading' | 'ready' | 'not_found' | 'closed' | 'error'

function BrandHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3.5">
      <div className="font-display text-[19px] font-extrabold tracking-[-.045em]">
        <span className="text-[#a7d52c]">Rota de </span><span className="text-white">Inovação</span>
      </div>
      <div className="flex items-center gap-2">
        <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-5 w-auto object-contain" />
        <div className="h-5 w-px bg-white/25" />
        <img src="/brand/enova.png" alt="Enova" className="h-[18px] w-auto object-contain" />
      </div>
    </header>
  )
}

function Dots() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] w-full opacity-40" viewBox="0 0 420 180" preserveAspectRatio="none" aria-hidden="true">
      <defs><pattern id="join-mobile-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#00b6da" /></pattern></defs>
      <path d="M-20 135 C72 72 144 184 230 122 C302 70 344 78 450 104 L450 190 L-20 190 Z" fill="url(#join-mobile-dots)" />
    </svg>
  )
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div className="inline-flex rounded-full border border-[#00b6da]/24 bg-[#00b6da]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#5ddcf2]">Rota de Inovação</div>
      <h1 className="mt-5 font-display text-[34px] font-extrabold leading-none tracking-[-.05em] text-white">{title}</h1>
      <p className="mt-4 max-w-[290px] text-sm leading-[1.65] text-white/58">{text}</p>
    </div>
  )
}

export function ParticipantJoinVisualPage() {
  const { codigo } = useParams<{ codigo: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<LiveQuizSession | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!codigo) return
    let active = true
    ;(async () => {
      const { data, error: fetchError } = await supabase
        .from('live_quiz_sessions')
        .select('*')
        .eq('code', codigo.toUpperCase())
        .maybeSingle()
      if (!active) return
      if (fetchError) return setState('error')
      if (!data) return setState('not_found')
      setSession(data)
      setState(data.status === 'finished' || data.status === 'cancelled' ? 'closed' : 'ready')
    })().catch(() => active && setState('error'))
    return () => { active = false }
  }, [codigo])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!displayName.trim()) {
      setError('Digite seu nome para entrar.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('join_live_quiz', {
      p_code: codigo ?? '',
      p_display_name: displayName.trim(),
      p_team: null,
      p_device_fingerprint: getLiveQuizDeviceFingerprint(),
    })
    setSubmitting(false)
    if (rpcError || !data) {
      setError('Não foi possível entrar na dinâmica. Tente novamente.')
      return
    }
    const result = data as unknown as { sessionId: string; participantId: string; joinToken: string }
    saveLiveQuizParticipant(result.sessionId, { participantId: result.participantId, joinToken: result.joinToken })
    navigate(`/quiz/${result.sessionId}/jogar/${result.participantId}`)
  }

  return (
    <main className="relative h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#020d23] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(23,77,145,.24),transparent_32%),radial-gradient(circle_at_88%_20%,rgba(0,182,218,.08),transparent_28%),linear-gradient(180deg,#03102b_0%,#020d23_100%)]" />
      <Dots />
      <div className="relative mx-auto flex h-full w-full max-w-[430px] flex-col px-5 py-4">
        <BrandHeader />

        {state === 'loading' && <Message title="Carregando…" text="Só um instante enquanto preparamos sua entrada." />}
        {state === 'not_found' && <Message title="Link inválido" text="Não encontramos esta dinâmica. Confira o QR Code e tente novamente." />}
        {state === 'closed' && <Message title="Dinâmica encerrada" text="Esta dinâmica já foi finalizada." />}
        {state === 'error' && <Message title="Não foi possível conectar" text="Verifique sua internet e abra o QR Code novamente." />}

        {state === 'ready' && (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col pt-5">
            <div className="inline-flex w-fit rounded-full border border-[#a7d52c]/24 bg-[#a7d52c]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#c1e944]">Bem-vindo</div>
            <h1 className="mt-5 font-display text-[40px] font-extrabold leading-[.97] tracking-[-.055em] text-white">Entre na<br /><span className="text-[#a7d52c]">dinâmica</span></h1>
            <p className="mt-5 max-w-[315px] text-sm leading-[1.65] text-white/58">Digite seu nome como você quer aparecer durante a experiência.</p>

            <div className="mt-8">
              <label htmlFor="participant-name" className="mb-2.5 block text-xs font-semibold text-white/55">Seu nome</label>
              <input
                id="participant-name"
                autoFocus
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ex.: Marcos Silva"
                className="w-full rounded-2xl border border-white/12 bg-white/[.045] px-4 py-[17px] text-[15px] font-medium text-white outline-none placeholder:text-white/25 focus:border-[#00b6da]/60"
              />
            </div>

            {error && <div className="mt-3 rounded-xl border border-[#ff7f71]/20 bg-[#ff7f71]/8 px-3 py-2.5 text-xs font-semibold text-[#ff9a90]">{error}</div>}

            <button disabled={submitting} className="mt-5 rounded-2xl bg-[#a7d52c] px-5 py-[17px] font-display text-[15px] font-extrabold text-[#07152f] shadow-[0_12px_32px_rgba(167,213,44,.14)] disabled:opacity-60">
              {submitting ? 'Entrando…' : 'Entrar na dinâmica'}
            </button>
            <div className="mt-4 text-center text-[11px] text-white/38">{session?.name ?? 'Rota de Inovação'} · um dispositivo por participante</div>
          </form>
        )}
      </div>
    </main>
  )
}
