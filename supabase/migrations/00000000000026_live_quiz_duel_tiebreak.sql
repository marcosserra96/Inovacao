-- Se uma semifinal (ou a final) empata de verdade, o apresentador pode
-- rodar uma pergunta extra pra decidir por jogo em vez de escolher um
-- vencedor manualmente. As perguntas extras vêm do pool da etapa 1 (bem
-- maior que o pool do duelo em si), pra não correr o risco de esgotar
-- as perguntas do duelo numa sequência de empates.
create function presenter_extend_duel_tiebreak(p_match_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_quiz_question_set_id uuid;
  v_next int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_match from duel_matches where id = p_match_id for update;
  if v_match.status <> 'finished' then
    raise exception 'Esta partida ainda não terminou';
  end if;
  if v_match.winner_player_id is not null then
    raise exception 'Esta partida já tem um vencedor definido';
  end if;

  select question_set_id into v_quiz_question_set_id
  from live_quiz_sessions
  where semifinal1_match_id = p_match_id or semifinal2_match_id = p_match_id or promoted_duel_match_id = p_match_id
  limit 1;

  v_next := v_match.current_round_number + 1;

  update duel_matches
  set status = 'in_progress',
      phase = 'ready',
      ended_at = null,
      rounds_total = v_next,
      current_round_number = v_next,
      question_set_id = coalesce(v_quiz_question_set_id, question_set_id)
  where id = p_match_id;

  perform log_audit('extend_duel_tiebreak', 'duel_matches', p_match_id, null);
  return json_build_object('roundNumber', v_next);
end;
$$;

grant execute on function presenter_extend_duel_tiebreak(uuid) to authenticated;
