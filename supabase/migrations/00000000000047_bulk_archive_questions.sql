-- Gestão segura do banco de perguntas entre eventos. Nenhuma pergunta histórica é apagada.
create or replace function public.presenter_archive_dynamic_questions(
  p_question_ids uuid[] default null,
  p_all_active boolean default false
) returns json
language plpgsql security definer set search_path=public as $$
declare
  v_ids uuid[];
  v_current uuid;
  v_state text;
  v_defaults public.live_quiz_defaults%rowtype;
begin
  select active_live_quiz_session_id into v_current
  from public.game_control where id=true for update;
  if v_current is not null then
    select flow_state into v_state from public.live_quiz_sessions where id=v_current;
    if v_state is not null and v_state <> 'finished' then
      raise exception 'Finalize a dinâmica em andamento antes de remover perguntas.';
    end if;
  end if;
  select * into v_defaults from public.live_quiz_defaults where id=true for update;
  select coalesce(array_agg(id),array[]::uuid[]) into v_ids
  from public.questions q
  where q.status='active'
    and q.type <> 'tiebreaker'
    and not q.is_demo
    and ('live_quiz'=any(q.modes) or 'duel'=any(q.modes))
    and (p_all_active or q.id=any(coalesce(p_question_ids,array[]::uuid[])));
  if cardinality(v_ids)>0 then
    delete from public.question_set_items
    where question_id=any(v_ids)
      and question_set_id in (v_defaults.question_set_id,v_defaults.duel_question_set_id,v_defaults.final_question_set_id);
    update public.questions set status='archived',updated_at=now() where id=any(v_ids);
    update public.live_quiz_defaults set updated_at=now() where id=true;
  end if;
  return public.presenter_get_dynamic_config();
end;
$$;
revoke all on function public.presenter_archive_dynamic_questions(uuid[],boolean) from public;
grant execute on function public.presenter_archive_dynamic_questions(uuid[],boolean) to anon,authenticated;

-- Validação definitiva no servidor: a sessão nova não pode começar vazia.
CREATE OR REPLACE FUNCTION public.presenter_prepare_current_dynamic(p_name text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Não permitir iniciar uma nova sessão sem um banco de perguntas preparado.
  if not exists (
    select 1 from question_set_items i join questions q on q.id=i.question_id
    where i.question_set_id=v_defaults.question_set_id and q.status='active'
  ) then
    raise exception 'Cadastre ou importe perguntas para o Quiz antes de iniciar.';
  end if;
  if v_defaults.enable_semifinals and not exists (
    select 1 from question_set_items i join questions q on q.id=i.question_id
    where i.question_set_id=v_defaults.duel_question_set_id and q.status='active'
  ) then
    raise exception 'Cadastre perguntas para as semifinais ou desative essa etapa.';
  end if;
  if v_defaults.enable_final and not exists (
    select 1 from question_set_items i join questions q on q.id=i.question_id
    where i.question_set_id=v_defaults.final_question_set_id and q.status='active'
  ) then
    raise exception 'Cadastre perguntas para a final ou desative essa etapa.';
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
$function$

