-- Configurações operacionais e encerramento da dinâmica pelo painel do apresentador.

alter table live_quiz_defaults
  add column if not exists question_time_seconds int not null default 20
  check (question_time_seconds between 5 and 120);

alter table live_quiz_sessions
  add column if not exists question_time_seconds int not null default 20
  check (question_time_seconds between 5 and 120);

alter table live_quiz_sessions drop constraint if exists live_quiz_sessions_flow_state_check;
alter table live_quiz_sessions
  add constraint live_quiz_sessions_flow_state_check
  check (flow_state in (
    'lobby','prepare','question','reveal','ranking','quiz_result',
    'semifinal_ready','semifinal','semifinal_result',
    'final_ready','final','champion','finished'
  ));

create or replace function presenter_finish_current_dynamic(p_session_id uuid)
returns json
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
  set status = 'finished',
      phase = 'quiz_finished',
      flow_state = 'finished',
      flow_deadline_at = null,
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      paused = false,
      finished_at = coalesce(finished_at, now()),
      updated_at = now()
  where id = p_session_id;

  update game_control
  set active_mode = 'none',
      active_live_quiz_session_id = null,
      active_individual_session_id = null,
      active_duel_match_id = null,
      updated_at = now()
  where id = true;

  return json_build_object('finished', true, 'sessionId', p_session_id);
end;
$$;

grant execute on function presenter_finish_current_dynamic(uuid) to anon, authenticated;

create or replace function presenter_get_dynamic_config()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_defaults live_quiz_defaults%rowtype;
  v_time int;
begin
  select * into v_defaults from live_quiz_defaults where id = true;
  select coalesce(question_time_seconds, 20) into v_time from live_quiz_defaults where id = true;

  return json_build_object(
    'questionSetId', v_defaults.question_set_id,
    'scoringConfigId', v_defaults.scoring_config_id,
    'questionsTotal', v_defaults.questions_total,
    'questionTimeSeconds', v_time,
    'showRankingAfterQuestion', v_defaults.show_ranking_after_question,
    'hideStatementOnPhone', v_defaults.hide_statement_on_phone,
    'finalistsCount', v_defaults.finalists_count,
    'revealSeconds', 3,
    'rankingSeconds', 3
  );
end;
$$;

grant execute on function presenter_get_dynamic_config() to anon, authenticated;

create or replace function presenter_save_dynamic_config(
  p_question_set_id uuid,
  p_scoring_config_id uuid,
  p_questions_total int,
  p_question_time_seconds int,
  p_show_ranking_after_question boolean,
  p_hide_statement_on_phone boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_id uuid;
begin
  if p_questions_total < 1 then raise exception 'A quantidade de perguntas deve ser maior que zero'; end if;
  if p_question_time_seconds < 5 or p_question_time_seconds > 120 then raise exception 'O tempo por pergunta deve ficar entre 5 e 120 segundos'; end if;

  update live_quiz_defaults
  set question_set_id = p_question_set_id,
      scoring_config_id = p_scoring_config_id,
      questions_total = p_questions_total,
      question_time_seconds = p_question_time_seconds,
      show_ranking_after_question = p_show_ranking_after_question,
      hide_statement_on_phone = p_hide_statement_on_phone,
      updated_at = now()
  where id = true;

  select active_live_quiz_session_id into v_current_id from game_control where id = true;

  if v_current_id is not null then
    update live_quiz_sessions
    set question_set_id = p_question_set_id,
        scoring_config_id = p_scoring_config_id,
        questions_total = p_questions_total,
        question_time_seconds = p_question_time_seconds,
        show_ranking_after_question = p_show_ranking_after_question,
        hide_statement_on_phone = p_hide_statement_on_phone,
        updated_at = now()
    where id = v_current_id and flow_state = 'lobby';
  end if;

  return presenter_get_dynamic_config();
end;
$$;

grant execute on function presenter_save_dynamic_config(uuid, uuid, int, int, boolean, boolean) to anon, authenticated;

-- O motor automático passa a respeitar o tempo configurado no painel.
create or replace function ensure_auto_live_quiz_round(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_round_id uuid;
  v_question_id uuid;
begin
  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;

  select id into v_round_id
  from live_quiz_rounds
  where session_id = p_session_id
    and round_number = v_session.current_question_number
    and not voided
  order by created_at desc
  limit 1;

  if v_round_id is not null then return v_round_id; end if;

  select q.id into v_question_id
  from question_set_items qsi
  join questions q on q.id = qsi.question_id
  where qsi.question_set_id = v_session.question_set_id
    and q.status = 'active'
    and q.type <> 'tiebreaker'
    and 'live_quiz' = any(q.modes)
    and q.id not in (
      select question_id from live_quiz_rounds
      where session_id = p_session_id and question_id is not null and not voided
    )
  order by random()
  limit 1;

  if v_question_id is null then raise exception 'Não há mais perguntas disponíveis neste conjunto para o quiz'; end if;

  insert into live_quiz_rounds (
    session_id, round_number, question_id, phase,
    timer_duration_seconds, timer_started_at, timer_paused_at, timer_accumulated_ms
  ) values (
    p_session_id, v_session.current_question_number, v_question_id, 'question_shown',
    coalesce(v_session.question_time_seconds, 20), null, null, 0
  ) returning id into v_round_id;

  return v_round_id;
end;
$$;
