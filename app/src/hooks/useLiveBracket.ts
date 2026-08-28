import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { QuestionPayload } from '@/types/domain'

type MatchState = {
  match: any | null
  players: any[]
  round: any | null
}

type BracketState = {
  semifinal1: MatchState
  semifinal2: MatchState
  final: MatchState
  question: QuestionPayload | null
}

const EMPTY_MATCH: MatchState = { match: null, players: [], round: null }
const EMPTY: BracketState = { semifinal1: EMPTY_MATCH, semifinal2: EMPTY_MATCH, final: EMPTY_MATCH, question: null }

async function loadMatch(matchId?: string | null): Promise<MatchState> {
  if (!matchId) return { ...EMPTY_MATCH }

  const [{ data: match }, { data: players }] = await Promise.all([
    supabase.from('duel_matches').select('*').eq('id', matchId).maybeSingle(),
    supabase.from('duel_players').select('*').eq('match_id', matchId).eq('is_active_disputant', true).order('joined_at'),
  ])

  if (!match) return { ...EMPTY_MATCH }

  const roundNumber = Number((match as any).current_round_number ?? 0)
  let round: any | null = null
  if (roundNumber > 0 && (match as any).status !== 'finished') {
    const { data } = await supabase
      .from('duel_rounds')
      .select('*')
      .eq('match_id', matchId)
      .eq('round_number', roundNumber)
      .eq('voided', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    round = data ?? null
  }

  return { match, players: players ?? [], round }
}

async function loadBye(participantId?: string | null): Promise<MatchState> {
  if (!participantId) return { ...EMPTY_MATCH }
  const { data } = await supabase
    .from('live_quiz_participants')
    .select('id,display_name,total_score,correct_count')
    .eq('id', participantId)
    .maybeSingle()
  if (!data) return { ...EMPTY_MATCH }

  const player = {
    id: `bye-${data.id}`,
    display_name: `${data.display_name} · direto para a Final`,
    total_score: data.total_score,
    correct_count: data.correct_count,
    promoted_from_live_quiz_participant_id: data.id,
  }
  return {
    match: {
      id: `bye-${data.id}`,
      status: 'finished',
      phase: 'match_ended',
      current_round_number: 0,
      rounds_total: 0,
      winner_player_id: player.id,
    },
    players: [player],
    round: null,
  }
}

export function useLiveBracket(session: any | null) {
  const [state, setState] = useState<BracketState>(EMPTY)

  useEffect(() => {
    if (!session?.id) {
      setState(EMPTY)
      return
    }

    let active = true
    let loading = false

    const load = async () => {
      if (!active || loading) return
      loading = true
      try {
        const mode = String(session.knockout_mode ?? '')
        const [rawSemifinal1, rawSemifinal2, final, bye] = await Promise.all([
          loadMatch(session.semifinal1_match_id),
          loadMatch(session.semifinal2_match_id),
          loadMatch(session.promoted_duel_match_id),
          mode === 'single_semifinal' ? loadBye(session.final_bye_participant_id) : Promise.resolve({ ...EMPTY_MATCH }),
        ])

        if (!active) return

        // No cenário de 3 participantes, preservamos visualmente a chave:
        // 1º aparece como bye e 2º×3º ocupa a segunda chave.
        const semifinal1 = mode === 'single_semifinal' ? bye : rawSemifinal1
        const semifinal2 = mode === 'single_semifinal' ? rawSemifinal1 : rawSemifinal2

        const flow = String(session.flow_state ?? '')
        const sourceRound = flow.startsWith('semifinal')
          ? (mode === 'single_semifinal' ? semifinal2.round : semifinal1.round)
          : flow.startsWith('final') || flow === 'champion'
            ? final.round
            : null
        let question: QuestionPayload | null = null

        if (sourceRound?.id) {
          const { data } = await supabase.rpc('get_public_duel_round_question', { p_round_id: sourceRound.id })
          question = (data as unknown as QuestionPayload) ?? null
        }

        if (active) setState({ semifinal1, semifinal2, final, question })
      } finally {
        loading = false
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 600)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [
    session?.id,
    session?.semifinal1_match_id,
    session?.semifinal2_match_id,
    session?.promoted_duel_match_id,
    session?.final_bye_participant_id,
    session?.knockout_mode,
    session?.flow_state,
  ])

  return state
}
