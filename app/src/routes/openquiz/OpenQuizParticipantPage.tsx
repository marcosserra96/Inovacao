import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { saveAttempt, getDeviceFingerprint } from '@/lib/individualAttemptStorage'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']

function BrandHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/10 pb-3.5">
      <div className="font-display text-[19px] font-extrabold tracking-[-.045em]">
        <span className="text-[#009FC2]">Quiz </span><span className="text-white">Energisa</span>
      </div>
      <img src="/brand/energisa.png" alt="Grupo Energisa" className="h-6 w-auto object-contain" />
    </header>
  )
}

function Dots() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[24%] w-full opacity-45" viewBox="0 0 420 180" preserveAspectRatio="none" aria-hidden="true">
      <defs><pattern id="quiz-mobile-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#009FC2" /></pattern></defs>
      <path d="M-20 135 C72 72 144 184 230 122 C302 70 344 78 450 104 L450 190 L-20 190 Z" fill="url(#quiz-mobile-dots)" />
    </svg>
  )
}

export function OpenQuizParticipantPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [team, setTeam] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    supabase.from('individual_sessions').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setSession(data ?? null)
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session || session.status !== 'open') return
    if (session.require_identification && !displayName.trim()) {
      setError('Informe seu nome para participar.')
      return
    }

    setSubmitting(true)
    setError(null)
    const { data, error } = await supabase.rpc('start_individual_attempt', {
      p_session_id: session.id,
      p_display_name: displayName.trim() || 'Participante',
      p_team: team.trim() || null,
      p_device_fingerprint: getDeviceFingerprint(),
    })
    setSubmitting(false)

    if (error || !data) {
      setError(error?.message.includes('já participou') ? 'Você já participou desta rodada.' : 'Não foi possível entrar agora. Tente novamente.')
      return
    }

    const result = data as { attemptId: string; participantId: string }
    saveAttempt(session.id, {
      attemptId: result.attemptId,
      participantId: result.participantId,
      displayName: displayName.trim() || 'Participante',
    })
    navigate(`/quiz/${session.id}/jogar`)
  }

  const open = session?.status === 'open'

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#020d23] px-5 pb-6 pt-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_4%,rgba(0,159,194,.26),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(243,112,33,.10),transparent_25%),linear-gradient(180deg,#04122d_0%,#020d23_100%)]" />
      <Dots />
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-40px)] max-w-md flex-col">
        <BrandHeader />

        <div className="flex flex-1 flex-col justify-center py-7">
          {loading ? (
            <div className="text-center text-white/50">Carregando quiz…</div>
          ) : !session ? (
            <div className="text-center">
              <div className="mx-auto mb-5 h-2 w-16 rounded-full bg-[#F37021]" />
              <h1 className="font-display text-3xl font-extrabold">Quiz ainda não configurado</h1>
            </div>
          ) : !open ? (
            <div className="text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-[#F37021]/30 bg-[#F37021]/10 text-[#F9A56F]">
                <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="9"/></svg>
              </div>
              <div className="mt-5 inline-flex rounded-full border border-[#F37021]/25 bg-[#F37021]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#F9A56F]">Respostas fechadas</div>
              <h1 className="mt-5 font-display text-[38px] font-extrabold leading-none tracking-[-.05em]">Aguarde a liberação</h1>
              <p className="mx-auto mt-4 max-w-[300px] text-sm leading-[1.65] text-white/55">O apresentador ainda não abriu esta rodada para respostas.</p>
            </div>
          ) : (
            <>
              <div className="inline-flex w-fit rounded-full border border-[#009FC2]/25 bg-[#009FC2]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#58D8ED]">Respostas abertas</div>
              <h1 className="mt-5 font-display text-[42px] font-extrabold leading-[.97] tracking-[-.055em]">Entre no<br /><span className="text-[#009FC2]">Quiz Energisa</span></h1>
              <p className="mt-5 max-w-[320px] text-sm leading-[1.65] text-white/58">{session.name}</p>

              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2.5 block text-xs font-semibold text-white/55">Seu nome</label>
                  <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} required={session.require_identification} placeholder="Como você quer aparecer no ranking" className="w-full rounded-2xl border border-white/12 bg-white/[.045] px-4 py-[17px] text-[15px] font-medium text-white outline-none placeholder:text-white/28 focus:border-[#009FC2]/55" />
                </div>
                <div>
                  <label className="mb-2.5 block text-xs font-semibold text-white/55">Área ou equipe <span className="text-white/30">(opcional)</span></label>
                  <input value={team} onChange={(e)=>setTeam(e.target.value)} className="w-full rounded-2xl border border-white/12 bg-white/[.045] px-4 py-[17px] text-[15px] font-medium text-white outline-none focus:border-[#009FC2]/55" />
                </div>
                {error && <p className="rounded-xl border border-[#F37021]/20 bg-[#F37021]/8 px-3 py-2.5 text-sm text-[#FFC29A]">{error}</p>}
                <button disabled={submitting} className="w-full rounded-2xl bg-[#F37021] px-5 py-[17px] font-display text-[15px] font-extrabold text-white shadow-[0_12px_32px_rgba(243,112,33,.18)] disabled:opacity-50">
                  {submitting ? 'Preparando…' : 'Começar quiz'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
