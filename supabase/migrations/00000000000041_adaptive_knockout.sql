-- Fluxo eliminatório adaptativo:
-- 1 participante  -> campeão direto
-- 2 participantes -> final direta
-- 3 participantes -> 1º recebe bye; 2º x 3º fazem uma semifinal
-- 4+ participantes -> Top 4; 1º x 4º e 2º x 3º

alter table live_quiz_sessions
  add column if not exists knockout_mode text,
  add column if not exists final_bye_participant_id uuid references live_quiz_participants(id) on delete set null,
  add column if not exists direct_champion_participant_id uuid references live_quiz_participants(id) on delete set null;

alter table live_quiz_sessions drop constraint if exists live_quiz_sessions_knockout_mode_check;
alter table live_quiz_sessions
  add constraint live_quiz_sessions_knockout_mode_check
  check (knockout_mode is null or knockout_mode in ('single_champion','direct_final','single_semifinal','standard_semifinals'));

create or replace function system_select_live_quiz_top4(p_session_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(participant_id order by rank, participant_id), '{}'::uuid[])
  into v_ids
  from (
    select r.participant_id, r.rank
    from v_live_quiz_ranking r
    join live_quiz_participants p on p.id = r.participant_id
    where r.session_id = p_session_id
      and p.connected
    order by r.rank, r.participant_id
    limit 4
  ) ranked;

  update live_quiz_participants
  set is_finalist = (id = any(v_ids)),
      is_spectator = not (id = any(v_ids))
  where session_id = p_session_id;

  return v_ids;
end;
$$;
revoke all on function system_select_live_quiz_top4(uuid) from public;

create or replace function presenter_start_current_semifinals(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_ids uuid[];
  v_count int;
  v_semi1 uuid;
  v_semi2 uuid;
  v_final uuid;
begin
  if not is_current_live_dynamic(p_session_id) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;

  if v_session.flow_state like 'semifinal_%'
     or v_session.flow_state like 'final_%'
     or v_session.flow_state = 'champion' then
    return json_build_object(
      'started', true,
      'mode', v_session.knockout_mode,
      'semifinal1MatchId', v_session.semifinal1_match_id,
      'semifinal2MatchId', v_session.semifinal2_match_id,
      'finalMatchId', v_session.promoted_duel_match_id,
      'championParticipantId', v_session.direct_champion_participant_id
    );
  end if;

  if v_session.flow_state <> 'quiz_result' then
    raise exception 'O quiz ainda não chegou ao fim';
  end if;

  v_ids := system_select_live_quiz_top4(p_session_id);
  v_count := coalesce(array_length(v_ids, 1), 0);
  if v_count = 0 then
    raise exception 'Não há participantes conectados elegíveis para a fase final';
  end if;

  update live_quiz_sessions
  set semifinal1_match_id = null,
      semifinal2_match_id = null,
      promoted_duel_match_id = null,
      final_bye_participant_id = null,
      direct_champion_participant_id = null,
      participant_ranking_visible = false,
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      paused = false,
      updated_at = now()
  where id = p_session_id;

  if v_count = 1 then
    update live_quiz_sessions
    set knockout_mode = 'single_champion',
        direct_champion_participant_id = v_ids[1],
        phase = 'match_ended',
        flow_state = 'champion',
        flow_deadline_at = null,
        updated_at = now()
    where id = p_session_id;

    return json_build_object('started', true, 'mode', 'single_champion', 'championParticipantId', v_ids[1]);
  end if;

  if v_count = 2 then
    v_final := create_live_quiz_duel_match(
      p_session_id,
      coalesce(v_session.name, 'Dinâmica') || ' — Final',
      array[v_ids[1], v_ids[2]],
      v_session.final_question_set_id,
      coalesce(v_session.final_rounds_total, v_session.duel_rounds_total)
    );

    update duel_matches
    set status = 'in_progress', phase = 'ready', current_round_number = 1
    where id = v_final;

    update live_quiz_sessions
    set knockout_mode = 'direct_final',
        promoted_duel_match_id = v_final,
        phase = 'duel_final',
        flow_state = 'final_prepare',
        flow_deadline_at = now() + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
        updated_at = now()
    where id = p_session_id;

    return json_build_object('started', true, 'mode', 'direct_final', 'finalMatchId', v_final, 'finalistIds', to_jsonb(v_ids));
  end if;

  if v_count = 3 then
    v_semi1 := create_live_quiz_duel_match(
      p_session_id,
      coalesce(v_session.name, 'Dinâmica') || ' — Semifinal',
      array[v_ids[2], v_ids[3]],
      v_session.duel_question_set_id,
      v_session.duel_rounds_total
    );

    update duel_matches
    set status = 'in_progress', phase = 'ready', current_round_number = 1, paired_match_id = null
    where id = v_semi1;

    update live_quiz_sessions
    set knockout_mode = 'single_semifinal',
        semifinal1_match_id = v_semi1,
        semifinal2_match_id = null,
        final_bye_participant_id = v_ids[1],
        phase = 'duel_semifinals',
        flow_state = 'semifinal_prepare',
        flow_deadline_at = now() + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
        updated_at = now()
    where id = p_session_id;

    return json_build_object('started', true, 'mode', 'single_semifinal', 'semifinal1MatchId', v_semi1, 'byeParticipantId', v_ids[1], 'finalistIds', to_jsonb(v_ids));
  end if;

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
  update duel_matches
  set status = 'in_progress', phase = 'ready', current_round_number = 1
  where id in (v_semi1, v_semi2);

  update live_quiz_sessions
  set knockout_mode = 'standard_semifinals',
      semifinal1_match_id = v_semi1,
      semifinal2_match_id = v_semi2,
      phase = 'duel_semifinals',
      flow_state = 'semifinal_prepare',
      flow_deadline_at = now() + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
      updated_at = now()
  where id = p_session_id;

  return json_build_object('started', true, 'mode', 'standard_semifinals', 'semifinal1MatchId', v_semi1, 'semifinal2MatchId', v_semi2, 'finalistIds', to_jsonb(v_ids));
end;
$$;
grant execute on function presenter_start_current_semifinals(uuid) to anon, authenticated;

create or replace function system_ensure_semifinal_round(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_match1 duel_matches%rowtype;
  v_match2 duel_matches%rowtype;
  v_round1 uuid;
  v_round2 uuid;
  v_question uuid;
  v_seconds int;
begin
  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  select * into v_match1 from duel_matches where id = v_session.semifinal1_match_id for update;
  if v_session.semifinal2_match_id is not null then
    select * into v_match2 from duel_matches where id = v_session.semifinal2_match_id for update;
  end if;

  if v_match1.id is null then raise exception 'Semifinal não preparada'; end if;
  if v_match2.id is not null and v_match1.current_round_number <> v_match2.current_round_number then
    raise exception 'Semifinais fora de sincronia';
  end if;

  select id, question_id into v_round1, v_question
  from duel_rounds
  where match_id = v_match1.id and round_number = v_match1.current_round_number and not voided
  order by created_at desc limit 1;

  if v_round1 is null then
    select q.id into v_question
    from question_set_items qsi
    join questions q on q.id = qsi.question_id
    where qsi.question_set_id = v_match1.question_set_id
      and q.status = 'active'
      and 'duel' = any(q.modes)
      and q.id not in (
        select dr.question_id from duel_rounds dr
        where dr.question_id is not null
          and (dr.match_id = v_match1.id or (v_match2.id is not null and dr.match_id = v_match2.id))
      )
    order by random() limit 1;

    if v_question is null then raise exception 'Não há mais perguntas disponíveis para a semifinal'; end if;
    v_seconds := greatest(5, coalesce(v_session.question_time_seconds, 20));

    insert into duel_rounds(match_id,round_number,question_id,phase,timer_duration_seconds,timer_started_at,timer_paused_at,timer_accumulated_ms)
    values(v_match1.id,v_match1.current_round_number,v_question,'awaiting_answers',v_seconds,now(),null,0)
    returning id into v_round1;
  else
    v_seconds := greatest(5, coalesce((select timer_duration_seconds from duel_rounds where id=v_round1), v_session.question_time_seconds,20));
    update duel_rounds set phase='awaiting_answers',timer_started_at=now(),timer_paused_at=null where id=v_round1;
  end if;

  if v_match2.id is not null then
    select id into v_round2 from duel_rounds
    where match_id=v_match2.id and round_number=v_match2.current_round_number and not voided
    order by created_at desc limit 1;

    if v_round2 is null then
      insert into duel_rounds(match_id,round_number,question_id,phase,timer_duration_seconds,timer_started_at,timer_paused_at,timer_accumulated_ms)
      values(v_match2.id,v_match2.current_round_number,v_question,'awaiting_answers',v_seconds,now(),null,0)
      returning id into v_round2;
    else
      update duel_rounds set question_id=v_question,phase='awaiting_answers',timer_duration_seconds=v_seconds,timer_started_at=now(),timer_paused_at=null where id=v_round2;
    end if;
    update duel_matches set phase='awaiting_answers' where id=v_match2.id;
  end if;

  update duel_matches set phase='awaiting_answers' where id=v_match1.id;
  return json_build_object('round1Id',v_round1,'round2Id',v_round2,'seconds',v_seconds);
end;
$$;
revoke all on function system_ensure_semifinal_round(uuid) from public;

create or replace function presenter_start_current_final(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_semi1 duel_matches%rowtype;
  v_semi2 duel_matches%rowtype;
  v_winner1 uuid;
  v_winner2 uuid;
  v_final uuid;
begin
  if not is_current_live_dynamic(p_session_id) then raise exception 'Esta não é a dinâmica atual'; end if;
  select * into v_session from live_quiz_sessions where id=p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;

  if v_session.promoted_duel_match_id is not null then
    return json_build_object('started',true,'matchId',v_session.promoted_duel_match_id,'mode',v_session.knockout_mode);
  end if;
  if v_session.flow_state <> 'semifinal_result' then raise exception 'A semifinal ainda não terminou'; end if;

  select * into v_semi1 from duel_matches where id=v_session.semifinal1_match_id;
  if v_semi1.status <> 'finished' or v_semi1.winner_player_id is null then raise exception 'A semifinal precisa ter um vencedor'; end if;
  select promoted_from_live_quiz_participant_id into v_winner1 from duel_players where id=v_semi1.winner_player_id;

  if v_session.knockout_mode='single_semifinal' then
    v_winner2 := v_session.final_bye_participant_id;
  else
    select * into v_semi2 from duel_matches where id=v_session.semifinal2_match_id;
    if v_semi2.status <> 'finished' or v_semi2.winner_player_id is null then raise exception 'As duas semifinais precisam ter um vencedor'; end if;
    select promoted_from_live_quiz_participant_id into v_winner2 from duel_players where id=v_semi2.winner_player_id;
  end if;

  if v_winner1 is null or v_winner2 is null then raise exception 'Não foi possível identificar os dois finalistas'; end if;

  v_final := create_live_quiz_duel_match(
    p_session_id,
    coalesce(v_session.name,'Dinâmica') || ' — Final',
    array[v_winner1,v_winner2],
    v_session.final_question_set_id,
    coalesce(v_session.final_rounds_total,v_session.duel_rounds_total)
  );
  update duel_matches set status='in_progress',phase='ready',current_round_number=1 where id=v_final;

  update live_quiz_sessions
  set promoted_duel_match_id=v_final,
      phase='duel_final',
      flow_state='final_prepare',
      flow_deadline_at=now()+make_interval(secs=>greatest(1,coalesce(prepare_seconds,3))),
      flow_remaining_ms=null,
      paused_from_flow_state=null,
      paused=false,
      updated_at=now()
  where id=p_session_id;

  return json_build_object('started',true,'matchId',v_final,'mode',v_session.knockout_mode);
end;
$$;
grant execute on function presenter_start_current_final(uuid) to anon, authenticated;

create or replace function tick_current_dynamic_flow(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_match1 duel_matches%rowtype;
  v_match2 duel_matches%rowtype;
  v_final duel_matches%rowtype;
  v_round1 duel_rounds%rowtype;
  v_round2 duel_rounds%rowtype;
  v_roundf duel_rounds%rowtype;
  v_payload json;
  v_seconds int;
  v_all_answered boolean := false;
  v_expected1 int := 0;
  v_expected2 int := 0;
  v_now timestamptz := clock_timestamp();
begin
  if not is_current_live_dynamic(p_session_id) then return json_build_object('ignored',true); end if;
  select * into v_session from live_quiz_sessions where id=p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;
  if v_session.paused then return json_build_object('flowState',v_session.flow_state,'paused',true); end if;

  if v_session.flow_state in ('prepare','question','reveal','ranking') then
    perform tick_live_quiz_flow(p_session_id);
    select * into v_session from live_quiz_sessions where id=p_session_id;
    if v_session.flow_state='quiz_result' then
      perform system_select_live_quiz_top4(p_session_id);
      update live_quiz_sessions set phase='finalists_reveal',updated_at=clock_timestamp() where id=p_session_id;
    end if;
    return json_build_object('flowState',v_session.flow_state,'deadlineAt',v_session.flow_deadline_at);
  end if;

  if v_session.flow_state='quiz_result' then
    perform system_select_live_quiz_top4(p_session_id);
    return json_build_object('flowState','quiz_result','deadlineAt',null);
  end if;

  if v_session.flow_state='semifinal_question' then
    select * into v_match1 from duel_matches where id=v_session.semifinal1_match_id;
    if v_session.semifinal2_match_id is not null then select * into v_match2 from duel_matches where id=v_session.semifinal2_match_id; end if;
    select * into v_round1 from duel_rounds where match_id=v_match1.id and round_number=v_match1.current_round_number and not voided order by created_at desc limit 1;
    if v_match2.id is not null then select * into v_round2 from duel_rounds where match_id=v_match2.id and round_number=v_match2.current_round_number and not voided order by created_at desc limit 1; end if;

    select count(*) into v_expected1 from duel_players where match_id=v_match1.id and is_active_disputant;
    if v_match2.id is not null then select count(*) into v_expected2 from duel_players where match_id=v_match2.id and is_active_disputant; end if;

    v_all_answered := v_round1.id is not null
      and (select count(*) from duel_answer_flags where round_id=v_round1.id and answered) >= v_expected1
      and (v_match2.id is null or (v_round2.id is not null and (select count(*) from duel_answer_flags where round_id=v_round2.id and answered) >= v_expected2));
  elsif v_session.flow_state='final_question' then
    select * into v_final from duel_matches where id=v_session.promoted_duel_match_id;
    select * into v_roundf from duel_rounds where match_id=v_final.id and round_number=v_final.current_round_number and not voided order by created_at desc limit 1;
    select count(*) into v_expected1 from duel_players where match_id=v_final.id and is_active_disputant;
    v_all_answered := v_roundf.id is not null and (select count(*) from duel_answer_flags where round_id=v_roundf.id and answered) >= v_expected1;
  end if;

  if not v_all_answered and (v_session.flow_deadline_at is null or v_session.flow_deadline_at>v_now) then
    return json_build_object('flowState',v_session.flow_state,'deadlineAt',v_session.flow_deadline_at);
  end if;

  if v_session.flow_state='semifinal_prepare' then
    v_payload:=system_ensure_semifinal_round(p_session_id);
    v_seconds:=coalesce((v_payload->>'seconds')::int,greatest(5,coalesce(v_session.question_time_seconds,20)));
    update live_quiz_sessions set flow_state='semifinal_question',flow_deadline_at=v_now+make_interval(secs=>v_seconds),updated_at=v_now where id=p_session_id;

  elsif v_session.flow_state='semifinal_question' then
    perform system_reveal_duel_match(v_session.semifinal1_match_id);
    if v_session.semifinal2_match_id is not null then perform system_reveal_duel_match(v_session.semifinal2_match_id); end if;
    update live_quiz_sessions set flow_state='semifinal_reveal',flow_deadline_at=v_now+make_interval(secs=>greatest(1,coalesce(reveal_seconds,3))),updated_at=v_now where id=p_session_id;

  elsif v_session.flow_state='semifinal_reveal' then
    select * into v_match1 from duel_matches where id=v_session.semifinal1_match_id for update;
    if v_session.semifinal2_match_id is not null then select * into v_match2 from duel_matches where id=v_session.semifinal2_match_id for update; end if;

    if v_match1.current_round_number>=v_match1.rounds_total then
      perform system_finish_duel_match(v_match1.id);
      if v_match2.id is not null then perform system_finish_duel_match(v_match2.id); end if;
      update live_quiz_sessions set flow_state='semifinal_result',flow_deadline_at=null,updated_at=v_now where id=p_session_id;
    else
      update duel_matches set current_round_number=current_round_number+1,phase='ready' where id=v_match1.id or id=v_match2.id;
      update live_quiz_sessions set flow_state='semifinal_prepare',flow_deadline_at=v_now+make_interval(secs=>greatest(1,coalesce(prepare_seconds,3))),updated_at=v_now where id=p_session_id;
    end if;

  elsif v_session.flow_state='final_prepare' then
    v_payload:=system_ensure_final_round(p_session_id);
    v_seconds:=coalesce((v_payload->>'seconds')::int,greatest(5,coalesce(v_session.question_time_seconds,20)));
    update live_quiz_sessions set flow_state='final_question',flow_deadline_at=v_now+make_interval(secs=>v_seconds),updated_at=v_now where id=p_session_id;

  elsif v_session.flow_state='final_question' then
    perform system_reveal_duel_match(v_session.promoted_duel_match_id);
    update live_quiz_sessions set flow_state='final_reveal',flow_deadline_at=v_now+make_interval(secs=>greatest(1,coalesce(reveal_seconds,3))),updated_at=v_now where id=p_session_id;

  elsif v_session.flow_state='final_reveal' then
    select * into v_final from duel_matches where id=v_session.promoted_duel_match_id for update;
    if v_final.current_round_number>=v_final.rounds_total then
      perform system_finish_duel_match(v_final.id);
      update live_quiz_sessions set flow_state='champion',flow_deadline_at=null,updated_at=v_now where id=p_session_id;
    else
      update duel_matches set current_round_number=current_round_number+1,phase='ready' where id=v_final.id;
      update live_quiz_sessions set flow_state='final_prepare',flow_deadline_at=v_now+make_interval(secs=>greatest(1,coalesce(prepare_seconds,3))),updated_at=v_now where id=p_session_id;
    end if;
  end if;

  select * into v_session from live_quiz_sessions where id=p_session_id;
  return json_build_object('flowState',v_session.flow_state,'deadlineAt',v_session.flow_deadline_at);
end;
$$;
grant execute on function tick_current_dynamic_flow(uuid) to anon, authenticated;
