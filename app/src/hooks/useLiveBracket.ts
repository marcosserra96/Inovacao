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
  if (roundNumber > 0) {
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
        const [semifinal1, semifinal2, final] = await Promise.all([
          loadMatch(session.semifinal1_match_id),
          loadMatch(session.semifinal2_match_id),
          loadMatch(session.promoted_duel_match_id),
        ])

        if (!active) return

        const flow = String(session.flow_state ?? '')
        const sourceRound = flow.startsWith('semifinal') ? semifinal1.round : flow.startsWith('final') || flow === 'champion' ? final.round : null
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
  }, [session?.id, session?.semifinal1_match_id, session?.semifinal2_match_id, session?.promoted_duel_match_id, session?.flow_state])

  return state
}
