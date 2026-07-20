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
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']
type Mode = 'none' | 'individual' | 'duel'

const modeLabel: Record<Mode, string> = { none: 'Nenhum', individual: 'Desafio individual', duel: 'Duelo ao vivo' }
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
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [scoringConfigs, setScoringConfigs] = useState<ScoringConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)

  async function loadOptions() {
    const [{ data: s }, { data: m }, { data: qs }, { data: sc }] = await Promise.all([
      supabase.from('individual_sessions').select('*').order('created_at', { ascending: false }),
      supabase
        .from('duel_matches')
        .select('*')
        .neq('status', 'finished')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
      supabase.from('question_sets').select('*').order('name'),
      supabase.from('scoring_configs').select('*').order('created_at'),
    ])
    setSessions(s ?? [])
    setMatches(m ?? [])
    setQuestionSets(qs ?? [])
    setScoringConfigs(sc ?? [])
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

  const activeSession = sessions.find((s) => s.id === control?.active_individual_session_id)
  const activeMatch = matches.find((m) => m.id === control?.active_duel_match_id)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <AdminShell>
      <h1 className="font-display text-2xl font-extrabold mb-1 text-primary-dark">Controle da dinâmica</h1>
      <p className="text-ink-muted mb-6">
        Defina o que está rolando agora — quem entrar pelo link do evento cai direto na atividade certa.
      </p>

      <div className="grid grid-cols-[1fr_auto] gap-6 items-start mb-6">
        <Card>
          <h2 className="font-display text-lg font-bold mb-4">Modo atual</h2>
          {loadingControl ? (
            <Spinner />
          ) : (
            <>
              <div className="flex gap-2 mb-5">
                {(['none', 'individual', 'duel'] as Mode[]).map((mode) => (
                  <Button
                    key={mode}
                    size="md"
                    variant={control?.active_mode === mode ? 'primary' : 'ghost'}
                    disabled={saving}
                    onClick={() => setMode(mode)}
                  >
                    {modeLabel[mode]}
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

              {control?.active_mode === 'none' && (
                <p className="text-sm text-ink-muted">
                  Ninguém consegue jogar agora — quem acessar o link vê uma tela de espera.
                </p>
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
