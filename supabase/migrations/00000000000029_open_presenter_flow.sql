-- Novo fluxo do apresentador sem senha.
-- Mantém /admin e as telas legadas protegidas. As RPCs abaixo só podem
-- operar sobre a dinâmica atualmente apontada por game_control.

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

  if v_defaults.question_set_id is null or v_defaults.scoring_config_id is null then
    raise exception 'Configure as perguntas da dinâmica antes de iniciar';
  end if;

  insert into live_quiz_sessions (
    name, question_set_id, scoring_config_id, questions_total,
    show_ranking_after_question, hide_statement_on_phone,
    finalists_count, duel_question_set_id, duel_scoring_config_id,
    duel_rounds_total, duel_win_condition,
    status, phase, presenter_id,
    flow_state, flow_deadline_at, flow_remaining_ms,
    paused_from_flow_state, paused, participant_ranking_visible, lobby_locked
  )
  values (
    coalesce(nullif(trim(p_name), ''), 'Dinâmica — ' || to_char(now(), 'DD/MM HH24:MI')),
    v_defaults.question_set_id, v_defaults.scoring_config_id, v_defaults.questions_total,
    v_defaults.show_ranking_after_question, v_defaults.hide_statement_on_phone,
    v_defaults.finalists_count, v_defaults.duel_question_set_id, v_defaults.duel_scoring_config_id,
    v_defaults.duel_rounds_total, v_defaults.duel_win_condition,
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

create or replace function presenter_prepare_new_dynamic(p_name text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_id uuid;
begin
  select active_live_quiz_session_id into v_current_id
  from game_control where id = true for update;

  if v_current_id is not null then
    update live_quiz_sessions
    set status = case when status = 'finished' then status else 'cancelled'::duel_match_status end,
        finished_at = coalesce(finished_at, now()),
        flow_deadline_at = null,
        paused = false,
        updated_at = now()
    where id = v_current_id;
  end if;

  update game_control
  set active_mode = 'none',
      active_live_quiz_session_id = null,
      active_individual_session_id = null,
      active_duel_match_id = null,
      updated_at = now()
  where id = true;

  return presenter_prepare_current_dynamic(p_name);
end;
$$;

grant execute on function presenter_prepare_new_dynamic(text) to anon, authenticated;

create or replace function presenter_start_auto_live_quiz(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_round_id uuid;
begin
  if not exists (
    select 1 from game_control
    where id = true and active_live_quiz_session_id = p_session_id
  ) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Dinâmica não encontrada';
  end if;

  if (select count(*) from live_quiz_participants where session_id = p_session_id and connected) = 0 then
    raise exception 'Nenhum participante conectado ainda';
  end if;

  if v_session.flow_state <> 'lobby' then
    return json_build_object('started', false, 'flowState', v_session.flow_state);
  end if;

  update live_quiz_sessions
  set status = 'in_progress',
      phase = 'ready',
      flow_state = 'prepare',
      current_question_number = 1,
      started_at = coalesce(started_at, now()),
      lobby_locked = true,
      paused = false,
      participant_ranking_visible = false,
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      flow_deadline_at = now() + make_interval(secs => prepare_seconds),
      updated_at = now()
  where id = p_session_id;

  v_round_id := ensure_auto_live_quiz_round(p_session_id);

  return json_build_object('started', true, 'flowState', 'prepare', 'roundId', v_round_id);
end;
$$;

grant execute on function presenter_start_auto_live_quiz(uuid) to anon, authenticated;

create or replace function presenter_pause_current_dynamic(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_round live_quiz_rounds%rowtype;
  v_remaining_ms bigint;
  v_now timestamptz := now();
begin
  if not exists (
    select 1 from game_control
    where id = true and active_live_quiz_session_id = p_session_id
  ) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;
  if v_session.paused then
    return json_build_object('paused', true, 'flowState', v_session.flow_state);
  end if;

  v_remaining_ms := case
    when v_session.flow_deadline_at is null then null
    else greatest(0, (extract(epoch from (v_session.flow_deadline_at - v_now)) * 1000)::bigint)
  end;

  if v_session.flow_state = 'question' then
    select * into v_round
    from live_quiz_rounds
    where session_id = p_session_id
      and round_number = v_session.current_question_number
      and not voided
    order by created_at desc
    limit 1;

    if found and v_round.timer_started_at is not null and v_round.timer_paused_at is null then
      update live_quiz_rounds
      set timer_accumulated_ms = timer_accumulated_ms + (extract(epoch from (v_now - timer_started_at)) * 1000)::bigint,
          timer_paused_at = v_now
      where id = v_round.id;
    end if;
  end if;

  update live_quiz_sessions
  set paused = true,
      paused_from_flow_state = flow_state,
      flow_remaining_ms = v_remaining_ms,
      flow_deadline_at = null,
      updated_at = v_now
  where id = p_session_id;

  return json_build_object('paused', true, 'flowState', v_session.flow_state, 'remainingMs', v_remaining_ms);
end;
$$;

grant execute on function presenter_pause_current_dynamic(uuid) to anon, authenticated;

create or replace function presenter_resume_current_dynamic(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_round live_quiz_rounds%rowtype;
  v_now timestamptz := now();
  v_deadline timestamptz;
begin
  if not exists (
    select 1 from game_control
    where id = true and active_live_quiz_session_id = p_session_id
  ) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;
  if not v_session.paused then
    return json_build_object('paused', false, 'flowState', v_session.flow_state, 'deadlineAt', v_session.flow_deadline_at);
  end if;

  v_deadline := case
    when v_session.flow_remaining_ms is null then null
    else v_now + (v_session.flow_remaining_ms * interval '1 millisecond')
  end;

  if v_session.paused_from_flow_state = 'question' then
    select * into v_round
    from live_quiz_rounds
    where session_id = p_session_id
      and round_number = v_session.current_question_number
      and not voided
    order by created_at desc
    limit 1;

    if found and v_round.timer_paused_at is not null then
      update live_quiz_rounds
      set timer_started_at = v_now,
          timer_paused_at = null
      where id = v_round.id;
    end if;
  end if;

  update live_quiz_sessions
  set paused = false,
      flow_deadline_at = v_deadline,
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      updated_at = v_now
  where id = p_session_id;

  return json_build_object('paused', false, 'flowState', v_session.flow_state, 'deadlineAt', v_deadline);
end;
$$;

grant execute on function presenter_resume_current_dynamic(uuid) to anon, authenticated;

create or replace function presenter_set_participant_ranking_visibility(p_session_id uuid, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from game_control
    where id = true and active_live_quiz_session_id = p_session_id
  ) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  update live_quiz_sessions
  set participant_ranking_visible = p_visible,
      updated_at = now()
  where id = p_session_id;
end;
$$;

grant execute on function presenter_set_participant_ranking_visibility(uuid, boolean) to anon, authenticated;
