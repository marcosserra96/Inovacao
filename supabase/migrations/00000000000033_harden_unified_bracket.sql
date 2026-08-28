-- Torna o comando de iniciar semifinais idempotente depois do primeiro clique.
create or replace function presenter_start_current_semifinals(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_ids uuid[];
  v_semi1 uuid;
  v_semi2 uuid;
begin
  if not is_current_live_dynamic(p_session_id) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;

  if v_session.flow_state like 'semifinal_%' then
    return json_build_object(
      'started', true,
      'semifinal1MatchId', v_session.semifinal1_match_id,
      'semifinal2MatchId', v_session.semifinal2_match_id
    );
  end if;

  if v_session.flow_state <> 'quiz_result' then
    raise exception 'O quiz ainda não chegou ao fim';
  end if;

  v_ids := system_select_live_quiz_top4(p_session_id);
  if coalesce(array_length(v_ids, 1), 0) < 4 then
    raise exception 'São necessários pelo menos 4 participantes para iniciar as semifinais';
  end if;

  v_semi1 := v_session.semifinal1_match_id;
  v_semi2 := v_session.semifinal2_match_id;

  if v_semi1 is null or v_semi2 is null then
    -- Chaveamento fixo: 1º x 4º e 2º x 3º.
    v_semi1 := create_live_quiz_duel_match(
      p_session_id,
      coalesce(v_session.name, 'Dinâmica') || ' — Semifinal 1',
      array[v_ids[1], v_ids[4]],
      v_session.duel_question_set_id,
      v_session.duel_rounds_total
    );
    v_semi2 := create_live_quiz_duel_match(
      p_session_id,
      coalesce(v_session.name, 'Dinâmica') || ' — Semifinal 2',
      array[v_ids[2], v_ids[3]],
      v_session.duel_question_set_id,
      v_session.duel_rounds_total
    );

    update duel_matches set paired_match_id = v_semi2 where id = v_semi1;
    update duel_matches set paired_match_id = v_semi1 where id = v_semi2;
  end if;

  update live_quiz_sessions
  set semifinal1_match_id = v_semi1,
      semifinal2_match_id = v_semi2,
      phase = 'duel_semifinals',
      flow_state = 'semifinal_prepare',
      flow_deadline_at = now() + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      paused = false,
      participant_ranking_visible = false,
      updated_at = now()
  where id = p_session_id;

  update duel_matches
  set status = 'in_progress', phase = 'ready', current_round_number = 1
  where id in (v_semi1, v_semi2);

  return json_build_object(
    'started', true,
    'semifinal1MatchId', v_semi1,
    'semifinal2MatchId', v_semi2,
    'finalistIds', to_jsonb(v_ids)
  );
end;
$$;

grant execute on function presenter_start_current_semifinals(uuid) to anon, authenticated;
