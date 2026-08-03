import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { QrCode } from '@/components/ui/QrCode'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { IndividualSessionForm } from './IndividualSessionForm'
import { useGameControl } from '@/hooks/useGameControl'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type DuelMatch = Database['public']['Tables']['duel_matches']['Row']
type LiveQuizSession = Database['public']['Tables']['live_quiz_sessions']['Row']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']
type Mode = 'none' | 'live_quiz' | 'individual' | 'duel'

const matchStatusLabel: Record<string, string> = {
  draft: 'Rascunho',
  lobby: 'Aguardando participantes',
  in_progress: 'Em andamento',
  finished: 'Encerrada',
  cancelled: 'Cancelada',
}

export function AdminGameControlPage() {
  const notify = useToast()
  const { control, loading: loadingControl } = useGameControl()
  const [sessions, setSessions] = useState<IndividualSession[]>([])
  const [matches, setMatches] = useState<DuelMatch[]>([])
  const [liveQuizzes, setLiveQuizzes] = useState<LiveQuizSession[]>([])
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [scoringConfigs, setScoringConfigs] = useState<ScoringConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [defaultsConfigured, setDefaultsConfigured] = useState<boolean | null>(null)

  async function loadOptions() {
    const [{ data: s }, { data: m }, { data: lq }, { data: qs }, { data: sc }, { data: def }] = await Promise.all([
      supabase.from('individual_sessions').select('*').order('created_at', { ascending: false }),
      supabase
        .from('duel_matches')
        .select('*')
        .neq('status', 'finished')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      supabase
        .from('live_quiz_sessions')
        .select('*')
        .neq('status', 'finished')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      supabase.from('question_sets').select('*').order('name'),
      supabase.from('scoring_configs').select('*').order('created_at'),
      supabase.from('live_quiz_defaults').select('question_set_id, scoring_config_id').eq('id', true).maybeSingle(),
    ])
    setSessions(s ?? [])
    setMatches(m ?? [])
    setLiveQuizzes(lq ?? [])
    setQuestionSets(qs ?? [])
    setScoringConfigs(sc ?? [])
    setDefaultsConfigured(Boolean(def?.question_set_id && def?.scoring_config_id))
  }

  useEffect(() => {
    loadOptions()
  }, [])

  async function setMode(mode: Mode) {
    setSaving(true)
    const { error } = await supabase
      .from('game_control')
      .update({
        active_mode: mode,
        active_individual_session_id: mode === 'individual' ? control?.active_individual_session_id ?? null : null,
        active_duel_match_id: mode === 'duel' ? control?.active_duel_match_id ?? null : null,
        active_live_quiz_session_id: mode === 'live_quiz' ? control?.active_live_quiz_session_id ?? null : null,
      })
      .eq('id', true)
    setSaving(false)
    if (error) notify(error.message, 'error')
  }

  async function setActiveSession(sessionId: string) {
    setSaving(true)
    const { error } = await supabase
      .from('game_control')
      .update({ active_mode: 'individual', active_individual_session_id: sessionId || null })
      .eq('id', true)
    setSaving(false)
    if (error) notify(error.message, 'error')
  }

  async function openSessionNow(sessionId: string) {
    setSaving(true)
    const { error } = await supabase.from('individual_sessions').update({ status: 'open' }).eq('id', sessionId)
    setSaving(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Sessão aberta — já dá pra entrar.')
    loadOptions()
  }

  async function setActiveMatch(matchId: string) {
    setSaving(true)
    const { error } = await supabase
      .from('game_control')
      .update({ active_mode: 'duel', active_duel_match_id: matchId || null })
      .eq('id', true)
    setSaving(false)
    if (error) notify(error.message, 'error')
  }

  async function setActiveLiveQuiz(sessionId: string) {
    setSaving(true)
    const { error } = await supabase
      .from('game_control')
      .update({ active_mode: 'live_quiz', active_live_quiz_session_id: sessionId || null })
      .eq('id', true)
    setSaving(false)
    if (error) notify(error.message, 'error')
  }

  // Um clique só: cria a sessão a partir da configuração salva
  // (live_quiz_defaults) e já ativa e abre o lobby — sem formulário.
  async function handleStartDynamic() {
    setStarting(true)
    const { data, error } = await supabase.rpc('presenter_start_live_quiz_from_defaults', { p_name: null })
    if (error || !data) {
      notify(error?.message ?? 'Erro ao iniciar a dinâmica', 'error')
      setStarting(false)
      return
    }
    const result = data as unknown as { sessionId: string }
    await supabase
      .from('game_control')
      .update({ active_mode: 'live_quiz', active_live_quiz_session_id: result.sessionId })
      .eq('id', true)
    setStarting(false)
    notify('Dinâmica iniciada!')
    loadOptions()
  }

  async function openLobbyNow(sessionId: string) {
    setSaving(true)
    const { error } = await supabase.rpc('presenter_open_live_quiz_lobby', { p_session_id: sessionId })
    setSaving(false)
    if (error) {
      notify(error.message, 'error')
      return
    }
    notify('Lobby aberto — já dá pra entrar.')
    loadOptions()
  }

  const activeSession = sessions.find((s) => s.id === control?.active_individual_session_id)
  const activeMatch = matches.find((m) => m.id === control?.active_duel_match_id)
  const activeLiveQuiz = liveQuizzes.find((q) => q.id === control?.active_live_quiz_session_id)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const hasLiveQuizRunning = control?.active_mode === 'live_quiz' && Boolean(activeLiveQuiz)

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-extrabold mb-1 text-primary-dark">Controle da dinâmica</h1>
      <p className="text-ink-muted mb-6">
        Defina o que está rolando agora — quem entrar pelo link do evento cai direto na atividade certa.
      </p>

      <div className="grid grid-cols-[1fr_auto] gap-6 items-start mb-6">
        <Card>
          {loadingControl ? (
            <Spinner />
          ) : hasLiveQuizRunning && activeLiveQuiz ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display text-lg font-bold">{activeLiveQuiz.name}</h2>
                <Badge tone={activeLiveQuiz.status === 'in_progress' ? 'success' : 'neutral'}>
                  {matchStatusLabel[activeLiveQuiz.status]}
                </Badge>
              </div>
              <p className="text-sm text-ink-muted mb-4">
                Código <span className="font-mono font-semibold text-ink">{activeLiveQuiz.code}</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {activeLiveQuiz.status === 'draft' && (
                  <Button disabled={saving} onClick={() => openLobbyNow(activeLiveQuiz.id)}>
                    Abrir lobby
                  </Button>
                )}
                <Link to={`/telao-quiz/${activeLiveQuiz.id}`} target="_blank">
                  <Button>Abrir telão</Button>
                </Link>
                <Link to={`/apresentador-quiz/${activeLiveQuiz.id}`} target="_blank">
                  <Button variant="accent">Painel do apresentador</Button>
                </Link>
              </div>
              {liveQuizzes.length > 1 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-ink-muted mb-1.5">Trocar para outra dinâmica em aberto:</p>
                  <Select value={activeLiveQuiz.id} onChange={(e) => setActiveLiveQuiz(e.target.value)}>
                    {liveQuizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name} — {matchStatusLabel[q.status]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-4 mt-4">
                <button
                  type="button"
                  className="text-xs text-ink-muted hover:text-danger underline"
                  disabled={saving}
                  onClick={() => setMode('none')}
                >
                  Encerrar dinâmica atual
                </button>
                <Link to="/admin/jogo/perguntas" className="text-xs text-ink-muted hover:text-ink underline">
                  ⚙️ Configurar perguntas
                </Link>
                <Link to="/admin/manutencao" className="text-xs text-ink-muted hover:text-ink underline">
                  🧹 Manutenção
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-lg font-bold mb-1">Nenhuma dinâmica em andamento</h2>
              {defaultsConfigured === false ? (
                <p className="text-sm text-danger mb-4">
                  Ainda não há perguntas configuradas —{' '}
                  <Link to="/admin/jogo/perguntas" className="underline font-medium">
                    configure aqui
                  </Link>{' '}
                  antes de iniciar.
                </p>
              ) : (
                <p className="text-sm text-ink-muted mb-4">
                  Um único botão já cria e abre a etapa 1 (quiz coletivo), usando as perguntas configuradas — a etapa
                  2 (duplas e final) é conduzida automaticamente a partir dela.
                </p>
              )}
              <div className="flex items-center gap-3">
                <Button size="xl" disabled={!defaultsConfigured || starting} onClick={handleStartDynamic}>
                  {starting ? 'Iniciando…' : '⚡ Iniciar dinâmica'}
                </Button>
                <Link to="/admin/jogo/perguntas" className="text-sm text-ink-muted hover:text-ink underline">
                  ⚙️ Configurar perguntas
                </Link>
                <Link to="/admin/manutencao" className="text-sm text-ink-muted hover:text-ink underline">
                  🧹 Manutenção
                </Link>
              </div>
              {liveQuizzes.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-ink-muted mb-1.5">Ou retomar uma já criada:</p>
                  <Select value="" onChange={(e) => e.target.value && setActiveLiveQuiz(e.target.value)}>
                    <option value="">Selecione…</option>
                    {liveQuizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name} — {matchStatusLabel[q.status]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}
        </Card>

        <Card className="text-center w-56 shrink-0">
          <p className="text-sm font-semibold text-ink-muted mb-3">QR Code do evento</p>
          <QrCode value={siteUrl} size={160} />
          <p className="text-xs text-ink-muted mt-3 break-all">{siteUrl}</p>
          <p className="text-xs text-ink-muted mt-2">Sempre o mesmo — leva direto para o modo ativo.</p>
        </Card>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-ink-muted hover:text-ink select-none mb-3">
          Opções avançadas — desafio individual avulso, duelo avulso
        </summary>
        <Card>
          <p className="text-xs text-ink-muted mb-4">
            Fora do fluxo padrão do evento (quiz coletivo → duplas → final) — use só para testes ou atividades à
            parte.
          </p>
          <div className="flex gap-2 mb-5">
            {(['individual', 'duel'] as Mode[]).map((mode) => (
              <Button
                key={mode}
                size="md"
                variant={control?.active_mode === mode ? 'primary' : 'ghost'}
                disabled={saving}
                onClick={() => setMode(mode)}
              >
                {mode === 'individual' ? 'Desafio individual' : 'Duelo ao vivo'}
              </Button>
            ))}
          </div>

          {control?.active_mode === 'individual' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Select
                  value={control.active_individual_session_id ?? ''}
                  onChange={(e) => setActiveSession(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Selecione a sessão ativa…</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.status}
                    </option>
                  ))}
                </Select>
                <Button
                  size="md"
                  variant="ghost"
                  disabled={questionSets.length === 0 || scoringConfigs.length === 0}
                  onClick={() => setCreatingSession(true)}
                >
                  + Nova sessão
                </Button>
              </div>
              {activeSession && (
                <div className="rounded-2xl bg-bg p-4 flex items-center gap-3 flex-wrap">
                  <Badge tone={activeSession.status === 'open' ? 'success' : 'neutral'}>{activeSession.status}</Badge>
                  <span className="text-sm text-ink-muted">
                    Código: <span className="font-mono font-semibold text-ink">{activeSession.code}</span>
                  </span>
                  <div className="flex gap-2 ml-auto">
                    {activeSession.status !== 'open' && (
                      <Button size="md" disabled={saving} onClick={() => openSessionNow(activeSession.id)}>
                        Abrir agora
                      </Button>
                    )}
                    <Link to={`/ranking/${activeSession.id}`} target="_blank">
                      <Button size="md" variant="ghost">
                        Abrir ranking (telão)
                      </Button>
                    </Link>
                    <Link to={`/admin/resultados/${activeSession.id}`}>
                      <Button size="md" variant="ghost">
                        Resultados
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              {sessions.length === 0 && (
                <p className="text-sm text-ink-muted">Nenhuma sessão individual criada ainda — crie uma acima.</p>
              )}
            </div>
          )}

          {control?.active_mode === 'duel' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Select value={control.active_duel_match_id ?? ''} onChange={(e) => setActiveMatch(e.target.value)} className="flex-1">
                  <option value="">Selecione a partida ativa…</option>
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? 'Duelo sem nome'} — {matchStatusLabel[m.status]}
                    </option>
                  ))}
                </Select>
                <Link to="/apresentador/nova">
                  <Button size="md" variant="ghost">
                    + Nova partida
                  </Button>
                </Link>
              </div>
              {activeMatch && (
                <div className="rounded-2xl bg-bg p-4 flex items-center gap-3 flex-wrap">
                  <Badge tone={activeMatch.status === 'in_progress' ? 'success' : 'neutral'}>
                    {matchStatusLabel[activeMatch.status]}
                  </Badge>
                  <span className="text-sm text-ink-muted">
                    Código: <span className="font-mono font-semibold text-ink">{activeMatch.code}</span>
                  </span>
                  <div className="flex gap-2 ml-auto">
                    <Link to={`/telao/${activeMatch.id}`} target="_blank">
                      <Button size="md">Abrir telão</Button>
                    </Link>
                    <Link to={`/apresentador/${activeMatch.id}`} target="_blank">
                      <Button size="md" variant="accent">
                        Painel do apresentador
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              {matches.length === 0 && (
                <p className="text-sm text-ink-muted">Nenhuma partida em aberto — crie uma nova acima.</p>
              )}
            </div>
          )}
        </Card>
      </details>

      <Modal open={creatingSession} onClose={() => setCreatingSession(false)} title="Nova sessão individual" wide>
        {creatingSession && (
          <IndividualSessionForm
            session={null}
            questionSets={questionSets}
            scoringConfigs={scoringConfigs}
            onCancel={() => setCreatingSession(false)}
            onSaved={(saved) => {
              setCreatingSession(false)
              loadOptions()
              setActiveSession(saved.id)
            }}
          />
        )}
      </Modal>
    </AdminShell>
  )
}
