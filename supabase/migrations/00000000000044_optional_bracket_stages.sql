-- Etapas eliminatórias opcionais (padrão mantém o comportamento anterior).
alter table live_quiz_defaults add column if not exists enable_semifinals boolean not null default true;
alter table live_quiz_defaults add column if not exists enable_final boolean not null default true;
alter table live_quiz_sessions add column if not exists enable_semifinals boolean not null default true;
alter table live_quiz_sessions add column if not exists enable_final boolean not null default true;

create or replace function presenter_get_stage_flags()
returns json language sql security definer set search_path=public as $$
  select json_build_object('enableSemifinals',enable_semifinals,'enableFinal',enable_final)
  from live_quiz_defaults where id=true;
$$;
grant execute on function presenter_get_stage_flags() to anon,authenticated;

create or replace function presenter_set_stage_flags(p_enable_semifinals boolean, p_enable_final boolean)
returns json language plpgsql security definer set search_path=public as $$
declare v_current_id uuid;
begin
  if p_enable_semifinals and not p_enable_final then
    raise exception 'As semifinais exigem uma final; desative também as semifinais';
  end if;
  update live_quiz_defaults set enable_semifinals=p_enable_semifinals,enable_final=p_enable_final,updated_at=now() where id=true;
  select active_live_quiz_session_id into v_current_id from game_control where id=true;
  update live_quiz_sessions set enable_semifinals=p_enable_semifinals,enable_final=p_enable_final,updated_at=now()
  where id=v_current_id and flow_state='lobby';
  return presenter_get_stage_flags();
end;
$$;
grant execute on function presenter_set_stage_flags(boolean,boolean) to anon,authenticated;

-- Inicialização das novas sessões copia a configuração da dinâmica.
create or replace function presenter_prepare_current_dynamic(p_name text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_id uuid;
  v_current live_quiz_sessions%rowtype;
  v_defaults live_quiz_defaults%rowtype;
  v_session_id uuid;
  v_code text;
begin
  select active_live_quiz_session_id
  into v_current_id
  from game_control
  where id = true
  for update;

  if v_current_id is not null then
    select * into v_current from live_quiz_sessions where id = v_current_id;
    if found and v_current.status not in ('finished', 'cancelled') then
      return json_build_object(
        'sessionId', v_current.id,
        'code', v_current.code,
        'reused', true,
        'flowState', v_current.flow_state
      );
    end if;
  end if;

  select * into v_defaults from live_quiz_defaults where id = true;

  if v_defaults.question_set_id is null or v_defaults.duel_question_set_id is null or v_defaults.final_question_set_id is null or v_defaults.scoring_config_id is null then
    raise exception 'Configure as perguntas da dinâmica antes de iniciar';
  end if;

  insert into live_quiz_sessions (
    name, question_set_id, scoring_config_id, questions_total, question_time_seconds,
    show_ranking_after_question, hide_statement_on_phone,
    enable_speed_bonus, end_when_all_answered,
    finalists_count, duel_question_set_id, duel_scoring_config_id,
    duel_rounds_total, duel_win_condition,
    final_question_set_id, final_rounds_total, enable_semifinals, enable_final,
    status, phase, presenter_id,
    flow_state, flow_deadline_at, flow_remaining_ms,
    paused_from_flow_state, paused, participant_ranking_visible, lobby_locked
  )
  values (
    coalesce(nullif(trim(p_name), ''), 'Dinâmica — ' || to_char(now(), 'DD/MM HH24:MI')),
    v_defaults.question_set_id, v_defaults.scoring_config_id, v_defaults.questions_total, v_defaults.question_time_seconds,
    v_defaults.show_ranking_after_question, v_defaults.hide_statement_on_phone,
    v_defaults.enable_speed_bonus, v_defaults.end_when_all_answered,
    4, v_defaults.duel_question_set_id, v_defaults.duel_scoring_config_id,
    v_defaults.duel_rounds_total, v_defaults.duel_win_condition,
    v_defaults.final_question_set_id, coalesce(v_defaults.final_rounds_total, v_defaults.duel_rounds_total), v_defaults.enable_semifinals, v_defaults.enable_final,
    'lobby', 'lobby', null,
    'lobby', null, null,
    null, false, false, false
  )
  returning id, code into v_session_id, v_code;

  update game_control
  set active_mode = 'live_quiz',
      active_live_quiz_session_id = v_session_id,
      active_individual_session_id = null,
      active_duel_match_id = null,
      updated_at = now()
  where id = true;

  return json_build_object(
    'sessionId', v_session_id,
    'code', v_code,
    'reused', false,
    'flowState', 'lobby'
  );
end;
$$;

grant execute on function presenter_prepare_current_dynamic(text) to anon, authenticated;

-- Fluxo eliminatório atualizado para refletir as etapas habilitadas.
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

  -- Sem final: o primeiro do ranking é campeão diretamente.
  -- Sem semifinais: os dois primeiros disputam a final.
  if not v_session.enable_final then
    v_ids := v_ids[1:1];
    v_count := 1;
    update live_quiz_participants set is_finalist = id = v_ids[1], is_spectator = id <> v_ids[1]
    where session_id = p_session_id;
  elsif not v_session.enable_semifinals and v_count > 2 then
    v_ids := v_ids[1:2];
    v_count := 2;
    update live_quiz_participants set is_finalist = id = any(v_ids), is_spectator = not (id = any(v_ids))
    where session_id = p_session_id;
  end if;

  if v_count=1 then
    v_final:=create_live_quiz_duel_match(
      p_session_id,
      coalesce(v_session.name,'Dinâmica')||' — Campeão',
      array[v_ids[1]],
      v_session.final_question_set_id,
      1
    );
    perform system_finish_duel_match(v_final);
    update live_quiz_sessions
    set knockout_mode='single_champion',direct_champion_participant_id=v_ids[1],
        promoted_duel_match_id=v_final,phase='quiz_finished',flow_state='champion',
        flow_deadline_at=null,updated_at=now()
    where id=p_session_id;
    return json_build_object('started',true,'mode','single_champion','championParticipantId',v_ids[1],'finalMatchId',v_final);
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

    -- O líder já está na final; durante a semifinal ele acompanha como espectador.
    update live_quiz_participants
    set is_finalist = id = any(array[v_ids[2],v_ids[3]]),
        is_spectator = id = v_ids[1] or not (id = any(v_ids))
    where session_id=p_session_id;

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

