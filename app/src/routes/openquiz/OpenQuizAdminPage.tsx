import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminShell } from '@/components/admin/AdminShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { IndividualSessionForm } from '@/routes/admin/IndividualSessionForm'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import type { Database } from '@/types/database.types'

type IndividualSession = Database['public']['Tables']['individual_sessions']['Row']
type QuestionSet = Database['public']['Tables']['question_sets']['Row']
type ScoringConfig = Database['public']['Tables']['scoring_configs']['Row']

export function OpenQuizAdminPage() {
  const notify = useToast()
  const [session, setSession] = useState<IndividualSession | null>(null)
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([])
  const [scoringConfigs, setScoringConfigs] = useState<ScoringConfig[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [s, qs, sc] = await Promise.all([
      supabase.from('individual_sessions').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('question_sets').select('*').order('name'),
      supabase.from('scoring_configs').select('*').order('created_at'),
    ])
    setSession(s.data ?? null)
    setQuestionSets(qs.data ?? [])
    setScoringConfigs(sc.data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleAnswers() {
    if (!session) return
    setBusy(true)
    const opening = session.status !== 'open'
    const { error } = await supabase
      .from('individual_sessions')
      .update(opening ? { status: 'open', opens_at: null, closes_at: null } : { status: 'closed' })
      .eq('id', session.id)
    setBusy(false)
    if (error) return notify(error.message, 'error')
    notify(opening ? 'Respostas abertas.' : 'Respostas encerradas.')
    load()
  }

  async function resetRanking() {
    if (!session) return
    if (!confirm('Zerar o ranking e iniciar uma nova rodada com a mesma configuração? O histórico anterior será preservado.')) return

    setBusy(true)
    const payload = {
      name: session.name,
      question_set_id: session.question_set_id,
      scoring_config_id: session.scoring_config_id,
      opens_at: null,
      closes_at: null,
      question_count: session.question_count,
      question_order: session.question_order,
      shuffle_options: session.shuffle_options,
      time_limit_seconds: session.time_limit_seconds,
      allow_retry: session.allow_retry,
      require_identification: session.require_identification,
      show_correct_answer: session.show_correct_answer,
      show_ranking: session.show_ranking,
      ranking_size: session.ranking_size,
      status: session.status === 'open' ? 'open' : 'closed',
    }

    const { error } = await supabase.from('individual_sessions').insert(payload)
    setBusy(false)
    if (error) return notify(error.message, 'error')
    notify('Ranking zerado. Uma nova rodada foi criada mantendo a configuração.')
    load()
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em]" style={{ color: '#009FC2' }}>Quiz Energisa</p>
          <h1 className="font-display text-3xl font-extrabold" style={{ color: '#005061' }}>Painel do apresentador</h1>
          <p className="mt-1 text-ink-muted">Controle o quiz aberto sem alterar o QR Code exibido no telão.</p>
        </div>
        <Link to="/telao" target="_blank">
          <Button>Abir telão</Button>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Rodada ativa</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold" style={{ color: '#005061' }}>{session?.name ?? 'Nenhuma rodada criada'}</h2>
              {session && <p className="mt-1 text-sm text-ink-muted">{session.question_count} perguntas · ordem {session.question_order === 'random' ? 'aleatória' : 'fixa'} · ranking com {session.ranking_size}</p>}
            </div>
            {session && (
              <span className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: session.status === 'open' ? '#009FC2' : '#F37021' }}>
                {session.status === 'open' ? 'Aceitando respostas' : 'Respostas fechadas'}
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Button onClick={toggleAnswers} disabled={!session || busy}>
              {session?.status === 'open' ? 'Fechar respostas' : 'Abrir respostas'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)} disabled={!session || busy}>Configurar quiz</Button>
            <Button variant="ghost" onClick={resetRanking} disabled={!session || busy}>Zerar ranking</Button>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Acesso fixo</p>
          <p className="mt-2 font-semibold" style={{ color: '#005061' }}>/participar</p>
          <p className="mt-2 text-sm text-ink-muted">O QR Code do telão sempre usa essa rota, mesmo quando o ranking é zerado ou uma nova rodada é criada.</p>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Card>
          <h3 className="font-display text-lg font-bold" style={{ color: '#005061' }}>Perguntas</h3>
          <p className="mt-2 text-sm text-ink-muted">Cadastre, edite e organize o banco de perguntas.</p>
          <Link to="/admin/perguntas"><Button variant="ghost" className="mt-4">Gerenciar perguntas</Button></Link>
        </Card>
        <Card>
          <h3 className="font-display text-lg font-bold" style={{ color: '#005061' }}>Conjuntos</h3>
          <p className="mt-2 text-sm text-ink-muted">Defina quais perguntas compõem cada quiz.</p>
          <Link to="/admin/conjuntos"><Button variant="ghost" className="mt-4">Gerenciar conjuntos</Button></Link>
        </Card>
        <Card>
          <h3 className="font-display text-lg font-bold" style={{ color: '#005061' }}>Identidade</h3>
          <p className="mt-2 text-sm text-ink-muted">Azul e laranja Energisa aplicados ao telão e ao fluxo principal.</p>
          <Link to="/admin/configuracoes"><Button variant="ghost" className="mt-4">Configurações visuais</Button></Link>
        </Card>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Configurar quiz" wide>
        {session && (
          <IndividualSessionForm
            session={session}
            questionSets={questionSets}
            scoringConfigs={scoringConfigs}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              load()
            }}
          />
        )}
      </Modal>
    </AdminShell>
  )
}
