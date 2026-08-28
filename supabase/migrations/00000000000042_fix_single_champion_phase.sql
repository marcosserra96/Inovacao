create or replace function presenter_start_current_semifinals(p_session_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_ids uuid[];
  v_count int;
  v_semi1 uuid;
  v_semi2 uuid;
  v_final uuid;
begin
  if not is_current_live_dynamic(p_session_id) then raise exception 'Esta não é a dinâmica atual'; end if;
  select * into v_session from live_quiz_sessions where id=p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;

  if v_session.flow_state like 'semifinal_%' or v_session.flow_state like 'final_%' or v_session.flow_state='champion' then
    return json_build_object('started',true,'mode',v_session.knockout_mode,'semifinal1MatchId',v_session.semifinal1_match_id,'semifinal2MatchId',v_session.semifinal2_match_id,'finalMatchId',v_session.promoted_duel_match_id,'championParticipantId',v_session.direct_champion_participant_id);
  end if;
  if v_session.flow_state<>'quiz_result' then raise exception 'O quiz ainda não chegou ao fim'; end if;

  v_ids:=system_select_live_quiz_top4(p_session_id);
  v_count:=coalesce(array_length(v_ids,1),0);
  if v_count=0 then raise exception 'Não há participantes conectados elegíveis para a fase final'; end if;

  update live_quiz_sessions
  set semifinal1_match_id=null,semifinal2_match_id=null,promoted_duel_match_id=null,
      final_bye_participant_id=null,direct_champion_participant_id=null,
      participant_ranking_visible=false,flow_remaining_ms=null,
      paused_from_flow_state=null,paused=false,updated_at=now()
  where id=p_session_id;

  if v_count=1 then
    update live_quiz_sessions
    set knockout_mode='single_champion',direct_champion_participant_id=v_ids[1],
        phase='quiz_finished',flow_state='champion',flow_deadline_at=null,updated_at=now()
    where id=p_session_id;
    return json_build_object('started',true,'mode','single_champion','championParticipantId',v_ids[1]);
  end if;

  if v_count=2 then
    v_final:=create_live_quiz_duel_match(p_session_id,coalesce(v_session.name,'Dinâmica')||' — Final',array[v_ids[1],v_ids[2]],v_session.final_question_set_id,coalesce(v_session.final_rounds_total,v_session.duel_rounds_total));
    update duel_matches set status='in_progress',phase='ready',current_round_number=1 where id=v_final;
    update live_quiz_sessions set knockout_mode='direct_final',promoted_duel_match_id=v_final,phase='duel_final',flow_state='final_prepare',flow_deadline_at=now()+make_interval(secs=>greatest(1,coalesce(prepare_seconds,3))),updated_at=now() where id=p_session_id;
    return json_build_object('started',true,'mode','direct_final','finalMatchId',v_final,'finalistIds',to_jsonb(v_ids));
  end if;

  if v_count=3 then
    v_semi1:=create_live_quiz_duel_match(p_session_id,coalesce(v_session.name,'Dinâmica')||' — Semifinal',array[v_ids[2],v_ids[3]],v_session.duel_question_set_id,v_session.duel_rounds_total);
    update duel_matches set status='in_progress',phase='ready',current_round_number=1,paired_match_id=null where id=v_semi1;
    update live_quiz_sessions set knockout_mode='single_semifinal',semifinal1_match_id=v_semi1,semifinal2_match_id=null,final_bye_participant_id=v_ids[1],phase='duel_semifinals',flow_state='semifinal_prepare',flow_deadline_at=now()+make_interval(secs=>greatest(1,coalesce(prepare_seconds,3))),updated_at=now() where id=p_session_id;
    return json_build_object('started',true,'mode','single_semifinal','semifinal1MatchId',v_semi1,'byeParticipantId',v_ids[1],'finalistIds',to_jsonb(v_ids));
  end if;

  v_semi1:=create_live_quiz_duel_match(p_session_id,coalesce(v_session.name,'Dinâmica')||' — Semifinal 1',array[v_ids[1],v_ids[4]],v_session.duel_question_set_id,v_session.duel_rounds_total);
  v_semi2:=create_live_quiz_duel_match(p_session_id,coalesce(v_session.name,'Dinâmica')||' — Semifinal 2',array[v_ids[2],v_ids[3]],v_session.duel_question_set_id,v_session.duel_rounds_total);
  update duel_matches set paired_match_id=v_semi2 where id=v_semi1;
  update duel_matches set paired_match_id=v_semi1 where id=v_semi2;
  update duel_matches set status='in_progress',phase='ready',current_round_number=1 where id in(v_semi1,v_semi2);
  update live_quiz_sessions set knockout_mode='standard_semifinals',semifinal1_match_id=v_semi1,semifinal2_match_id=v_semi2,phase='duel_semifinals',flow_state='semifinal_prepare',flow_deadline_at=now()+make_interval(secs=>greatest(1,coalesce(prepare_seconds,3))),updated_at=now() where id=p_session_id;
  return json_build_object('started',true,'mode','standard_semifinals','semifinal1MatchId',v_semi1,'semifinal2MatchId',v_semi2,'finalistIds',to_jsonb(v_ids));
end; $$;
grant execute on function presenter_start_current_semifinals(uuid) to anon,authenticated;
