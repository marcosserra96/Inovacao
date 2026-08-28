-- Redesenha a configuração do apresentador para o fluxo único da Rota de Inovação.
-- A configuração passa a expor somente decisões operacionais e permite CRUD seguro
-- das perguntas sem alterar o histórico de rodadas já realizadas.

alter table live_quiz_defaults
  add column if not exists enable_speed_bonus boolean not null default true,
  add column if not exists end_when_all_answered boolean not null default true;

create or replace function presenter_get_dynamic_config()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_defaults live_quiz_defaults%rowtype;
  v_quiz_selected json;
  v_semifinal_selected json;
  v_final_selected json;
  v_questions json;
  v_scoring json;
begin
  select * into v_defaults from live_quiz_defaults where id = true;

  select coalesce(json_agg(qsi.question_id order by qsi.position), '[]'::json)
  into v_quiz_selected
  from question_set_items qsi
  where qsi.question_set_id = v_defaults.question_set_id;

  select coalesce(json_agg(qsi.question_id order by qsi.position), '[]'::json)
  into v_semifinal_selected
  from question_set_items qsi
  where qsi.question_set_id = v_defaults.duel_question_set_id;

  select coalesce(json_agg(qsi.question_id order by qsi.position), '[]'::json)
  into v_final_selected
  from question_set_items qsi
  where qsi.question_set_id = v_defaults.final_question_set_id;

  select coalesce(json_agg(json_build_object(
    'id', q.id,
    'statement', q.statement,
    'explanation', q.explanation,
    'status', q.status,
    'type', q.type,
    'difficulty', q.difficulty,
    'basePoints', q.base_points,
    'quizSelected', exists (
      select 1 from question_set_items qsi
      where qsi.question_set_id = v_defaults.question_set_id and qsi.question_id = q.id
    ),
    'semifinalSelected', exists (
      select 1 from question_set_items qsi
      where qsi.question_set_id = v_defaults.duel_question_set_id and qsi.question_id = q.id
    ),
    'finalSelected', exists (
      select 1 from question_set_items qsi
      where qsi.question_set_id = v_defaults.final_question_set_id and qsi.question_id = q.id
    ),
    'used', (
      exists (select 1 from live_quiz_rounds lr where lr.question_id = q.id)
      or exists (select 1 from duel_rounds dr where dr.question_id = q.id)
      or exists (select 1 from individual_answers ia where ia.question_id = q.id)
    ),
    'options', (
      select coalesce(json_agg(json_build_object(
        'id', qo.id,
        'text', qo.text,
        'isCorrect', qo.is_correct,
        'position', qo.position
      ) order by qo.position), '[]'::json)
      from question_options qo
      where qo.question_id = q.id
    )
  ) order by
    case q.status when 'active' then 0 when 'inactive' then 1 else 2 end,
    q.created_at desc), '[]'::json)
  into v_questions
  from questions q
  where q.type <> 'tiebreaker'
    and not q.is_demo
    and ('live_quiz' = any(q.modes) or 'duel' = any(q.modes));

  select coalesce(json_agg(json_build_object(
    'id', s.id,
    'name', s.name,
    'isDefault', s.is_default
  ) order by s.is_default desc, s.name), '[]'::json)
  into v_scoring
  from scoring_configs s;

  return json_build_object(
    'questionSetId', v_defaults.question_set_id,
    'duelQuestionSetId', v_defaults.duel_question_set_id,
    'finalQuestionSetId', v_defaults.final_question_set_id,
    'selectedQuestionIds', v_quiz_selected,
    'semifinalQuestionIds', v_semifinal_selected,
    'finalQuestionIds', v_final_selected,
    'questions', v_questions,
    'scoringConfigs', v_scoring,
    'scoringConfigId', v_defaults.scoring_config_id,
    'questionsTotal', v_defaults.questions_total,
    'questionTimeSeconds', v_defaults.question_time_seconds,
    'duelRoundsTotal', v_defaults.duel_rounds_total,
    'finalRoundsTotal', coalesce(v_defaults.final_rounds_total, v_defaults.duel_rounds_total),
    'showRankingAfterQuestion', v_defaults.show_ranking_after_question,
    'hideStatementOnPhone', v_defaults.hide_statement_on_phone,
    'enableSpeedBonus', v_defaults.enable_speed_bonus,
    'endWhenAllAnswered', v_defaults.end_when_all_answered,
    'finalistsCount', 4,
    'prepareSeconds', 4,
    'revealSeconds', 5,
    'rankingSeconds', 6
  );
end;
$$;

grant execute on function presenter_get_dynamic_config() to anon, authenticated;

create or replace function presenter_save_dynamic_config_v2(
  p_quiz_question_ids uuid[],
  p_semifinal_question_ids uuid[],
  p_final_question_ids uuid[],
  p_questions_total int,
  p_question_time_seconds int,
  p_duel_rounds_total int,
  p_final_rounds_total int,
  p_show_ranking_after_question boolean,
  p_hide_statement_on_phone boolean,
  p_enable_speed_bonus boolean,
  p_end_when_all_answered boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_defaults live_quiz_defaults%rowtype;
  v_quiz_set uuid;
  v_duel_set uuid;
  v_final_set uuid;
  v_current_id uuid;
  v_quiz_count int;
  v_semifinal_count int;
  v_final_count int;
begin
  select count(distinct x) into v_quiz_count from unnest(coalesce(p_quiz_question_ids, '{}'::uuid[])) x;
  select count(distinct x) into v_semifinal_count from unnest(coalesce(p_semifinal_question_ids, '{}'::uuid[])) x;
  select count(distinct x) into v_final_count from unnest(coalesce(p_final_question_ids, '{}'::uuid[])) x;

  if v_quiz_count = 0 then raise exception 'Selecione ao menos uma pergunta para o quiz'; end if;
  if v_semifinal_count = 0 then raise exception 'Selecione ao menos uma pergunta para as semifinais'; end if;
  if v_final_count = 0 then raise exception 'Selecione ao menos uma pergunta para a final'; end if;

  if p_questions_total < 1 or p_questions_total > v_quiz_count then
    raise exception 'A quantidade de perguntas do quiz deve ficar entre 1 e %', v_quiz_count;
  end if;
  if p_duel_rounds_total < 1 or p_duel_rounds_total > v_semifinal_count then
    raise exception 'As semifinais precisam ter entre 1 e % perguntas', v_semifinal_count;
  end if;
  if p_final_rounds_total < 1 or p_final_rounds_total > v_final_count then
    raise exception 'A final precisa ter entre 1 e % perguntas', v_final_count;
  end if;
  if p_question_time_seconds < 5 or p_question_time_seconds > 120 then
    raise exception 'O tempo por pergunta deve ficar entre 5 e 120 segundos';
  end if;

  if (select count(*) from questions q where q.id = any(coalesce(p_quiz_question_ids, '{}'::uuid[])) and q.status = 'active' and q.type <> 'tiebreaker' and 'live_quiz' = any(q.modes)) <> v_quiz_count then
    raise exception 'Há uma pergunta inválida ou inativa selecionada para o quiz';
  end if;
  if (select count(*) from questions q where q.id = any(coalesce(p_semifinal_question_ids, '{}'::uuid[])) and q.status = 'active' and q.type <> 'tiebreaker' and 'duel' = any(q.modes)) <> v_semifinal_count then
    raise exception 'Há uma pergunta inválida ou inativa selecionada para as semifinais';
  end if;
  if (select count(*) from questions q where q.id = any(coalesce(p_final_question_ids, '{}'::uuid[])) and q.status = 'active' and q.type <> 'tiebreaker' and 'duel' = any(q.modes)) <> v_final_count then
    raise exception 'Há uma pergunta inválida ou inativa selecionada para a final';
  end if;

  select * into v_defaults from live_quiz_defaults where id = true for update;
  v_quiz_set := v_defaults.question_set_id;
  v_duel_set := v_defaults.duel_question_set_id;
  v_final_set := v_defaults.final_question_set_id;

  if v_quiz_set is null then
    insert into question_sets (name) values ('Dinâmica — Quiz coletivo') returning id into v_quiz_set;
  end if;
  if v_duel_set is null then
    insert into question_sets (name) values ('Dinâmica — Semifinais') returning id into v_duel_set;
  end if;
  if v_final_set is null then
    insert into question_sets (name) values ('Dinâmica — Final') returning id into v_final_set;
  end if;

  delete from question_set_items where question_set_id = v_quiz_set;
  insert into question_set_items (question_set_id, question_id, position)
  select v_quiz_set, qid, min(ord)::int - 1
  from unnest(p_quiz_question_ids) with ordinality as x(qid, ord)
  group by qid
  order by min(ord);

  delete from question_set_items where question_set_id = v_duel_set;
  insert into question_set_items (question_set_id, question_id, position)
  select v_duel_set, qid, min(ord)::int - 1
  from unnest(p_semifinal_question_ids) with ordinality as x(qid, ord)
  group by qid
  order by min(ord);

  delete from question_set_items where question_set_id = v_final_set;
  insert into question_set_items (question_set_id, question_id, position)
  select v_final_set, qid, min(ord)::int - 1
  from unnest(p_final_question_ids) with ordinality as x(qid, ord)
  group by qid
  order by min(ord);

  update live_quiz_defaults
  set question_set_id = v_quiz_set,
      duel_question_set_id = v_duel_set,
      final_question_set_id = v_final_set,
      questions_total = p_questions_total,
      question_time_seconds = p_question_time_seconds,
      duel_rounds_total = p_duel_rounds_total,
      final_rounds_total = p_final_rounds_total,
      show_ranking_after_question = p_show_ranking_after_question,
      hide_statement_on_phone = p_hide_statement_on_phone,
      enable_speed_bonus = p_enable_speed_bonus,
      end_when_all_answered = p_end_when_all_answered,
      finalists_count = 4,
      updated_at = now()
  where id = true;

  select active_live_quiz_session_id into v_current_id from game_control where id = true;
  if v_current_id is not null then
    update live_quiz_sessions
    set question_set_id = v_quiz_set,
        duel_question_set_id = v_duel_set,
        final_question_set_id = v_final_set,
        questions_total = p_questions_total,
        question_time_seconds = p_question_time_seconds,
        duel_rounds_total = p_duel_rounds_total,
        final_rounds_total = p_final_rounds_total,
        show_ranking_after_question = p_show_ranking_after_question,
        hide_statement_on_phone = p_hide_statement_on_phone,
        enable_speed_bonus = p_enable_speed_bonus,
        end_when_all_answered = p_end_when_all_answered,
        finalists_count = 4,
        updated_at = now()
    where id = v_current_id and flow_state = 'lobby';
  end if;

  return presenter_get_dynamic_config();
end;
$$;

grant execute on function presenter_save_dynamic_config_v2(uuid[], uuid[], uuid[], int, int, int, int, boolean, boolean, boolean, boolean) to anon, authenticated;

create or replace function presenter_upsert_dynamic_question(
  p_question_id uuid,
  p_statement text,
  p_explanation text,
  p_options jsonb,
  p_use_in_quiz boolean,
  p_use_in_semifinal boolean,
  p_use_in_final boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_defaults live_quiz_defaults%rowtype;
  v_existing questions%rowtype;
  v_target_id uuid;
  v_used boolean := false;
  v_correct_count int;
  v_option_count int;
  v_bad_options int;
  v_quiz_set uuid;
  v_duel_set uuid;
  v_final_set uuid;
begin
  if nullif(trim(coalesce(p_statement, '')), '') is null then
    raise exception 'Digite o enunciado da pergunta';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'Alternativas inválidas';
  end if;

  select jsonb_array_length(p_options) into v_option_count;
  if v_option_count < 2 or v_option_count > 6 then
    raise exception 'Use entre 2 e 6 alternativas';
  end if;

  select count(*) into v_correct_count
  from jsonb_array_elements(p_options) item
  where coalesce((item->>'isCorrect')::boolean, false);
  if v_correct_count <> 1 then
    raise exception 'Marque exatamente uma alternativa correta';
  end if;

  select count(*) into v_bad_options
  from jsonb_array_elements(p_options) item
  where nullif(trim(coalesce(item->>'text', '')), '') is null;
  if v_bad_options > 0 then
    raise exception 'Preencha todas as alternativas';
  end if;

  select * into v_defaults from live_quiz_defaults where id = true for update;
  v_quiz_set := v_defaults.question_set_id;
  v_duel_set := v_defaults.duel_question_set_id;
  v_final_set := v_defaults.final_question_set_id;

  if v_quiz_set is null then insert into question_sets (name) values ('Dinâmica — Quiz coletivo') returning id into v_quiz_set; end if;
  if v_duel_set is null then insert into question_sets (name) values ('Dinâmica — Semifinais') returning id into v_duel_set; end if;
  if v_final_set is null then insert into question_sets (name) values ('Dinâmica — Final') returning id into v_final_set; end if;

  if p_question_id is not null then
    select * into v_existing from questions where id = p_question_id for update;
    if not found then raise exception 'Pergunta não encontrada'; end if;
    if v_existing.type = 'tiebreaker' then raise exception 'Perguntas de desempate não são editadas por esta tela'; end if;

    v_used := exists (select 1 from live_quiz_rounds where question_id = p_question_id)
      or exists (select 1 from duel_rounds where question_id = p_question_id)
      or exists (select 1 from individual_answers where question_id = p_question_id);
  end if;

  if p_question_id is null then
    insert into questions (
      statement, difficulty, type, time_limit_seconds, base_points,
      explanation, status, modes, tags, is_demo
    ) values (
      trim(p_statement), 'medium', 'single_choice', 20, 100,
      nullif(trim(coalesce(p_explanation, '')), ''), 'active',
      array['individual','duel','live_quiz']::game_mode[], '{}'::text[], false
    ) returning id into v_target_id;
  elsif v_used or v_existing.status = 'archived' then
    insert into questions (
      statement, category_id, difficulty, type, time_limit_seconds, base_points,
      media_url, explanation, status, modes, tags, is_demo
    ) values (
      trim(p_statement), v_existing.category_id, v_existing.difficulty, v_existing.type,
      v_existing.time_limit_seconds, v_existing.base_points, v_existing.media_url,
      nullif(trim(coalesce(p_explanation, '')), ''), 'active',
      array['individual','duel','live_quiz']::game_mode[], v_existing.tags, false
    ) returning id into v_target_id;

    update questions set status = 'archived', updated_at = now() where id = p_question_id;
  else
    v_target_id := p_question_id;
    update questions
    set statement = trim(p_statement),
        explanation = nullif(trim(coalesce(p_explanation, '')), ''),
        status = 'active',
        modes = array['individual','duel','live_quiz']::game_mode[],
        updated_at = now()
    where id = v_target_id;

    delete from question_options where question_id = v_target_id;
  end if;

  insert into question_options (question_id, text, is_correct, position)
  select v_target_id,
         trim(item->>'text'),
         coalesce((item->>'isCorrect')::boolean, false),
         ordinality::int - 1
  from jsonb_array_elements(p_options) with ordinality as x(item, ordinality);

  delete from question_set_items
  where question_id in (coalesce(p_question_id, v_target_id), v_target_id)
    and question_set_id in (v_quiz_set, v_duel_set, v_final_set);

  if p_use_in_quiz then
    insert into question_set_items (question_set_id, question_id, position)
    values (v_quiz_set, v_target_id, coalesce((select max(position) + 1 from question_set_items where question_set_id = v_quiz_set), 0))
    on conflict do nothing;
  end if;
  if p_use_in_semifinal then
    insert into question_set_items (question_set_id, question_id, position)
    values (v_duel_set, v_target_id, coalesce((select max(position) + 1 from question_set_items where question_set_id = v_duel_set), 0))
    on conflict do nothing;
  end if;
  if p_use_in_final then
    insert into question_set_items (question_set_id, question_id, position)
    values (v_final_set, v_target_id, coalesce((select max(position) + 1 from question_set_items where question_set_id = v_final_set), 0))
    on conflict do nothing;
  end if;

  update live_quiz_defaults
  set question_set_id = v_quiz_set,
      duel_question_set_id = v_duel_set,
      final_question_set_id = v_final_set,
      updated_at = now()
  where id = true;

  return presenter_get_dynamic_config();
end;
$$;

grant execute on function presenter_upsert_dynamic_question(uuid, text, text, jsonb, boolean, boolean, boolean) to anon, authenticated;

create or replace function presenter_delete_dynamic_question(p_question_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_defaults live_quiz_defaults%rowtype;
  v_used boolean;
  v_quiz_remaining int;
  v_duel_remaining int;
  v_final_remaining int;
  v_selected_quiz boolean;
  v_selected_duel boolean;
  v_selected_final boolean;
  v_current_id uuid;
begin
  if not exists (select 1 from questions where id = p_question_id and type <> 'tiebreaker') then
    raise exception 'Pergunta não encontrada';
  end if;

  select * into v_defaults from live_quiz_defaults where id = true for update;

  v_selected_quiz := exists (select 1 from question_set_items where question_set_id = v_defaults.question_set_id and question_id = p_question_id);
  v_selected_duel := exists (select 1 from question_set_items where question_set_id = v_defaults.duel_question_set_id and question_id = p_question_id);
  v_selected_final := exists (select 1 from question_set_items where question_set_id = v_defaults.final_question_set_id and question_id = p_question_id);

  select count(*) into v_quiz_remaining from question_set_items where question_set_id = v_defaults.question_set_id and question_id <> p_question_id;
  select count(*) into v_duel_remaining from question_set_items where question_set_id = v_defaults.duel_question_set_id and question_id <> p_question_id;
  select count(*) into v_final_remaining from question_set_items where question_set_id = v_defaults.final_question_set_id and question_id <> p_question_id;

  if v_selected_quiz and v_quiz_remaining = 0 then raise exception 'O quiz precisa manter pelo menos uma pergunta'; end if;
  if v_selected_duel and v_duel_remaining = 0 then raise exception 'As semifinais precisam manter pelo menos uma pergunta'; end if;
  if v_selected_final and v_final_remaining = 0 then raise exception 'A final precisa manter pelo menos uma pergunta'; end if;

  delete from question_set_items
  where question_id = p_question_id
    and question_set_id in (v_defaults.question_set_id, v_defaults.duel_question_set_id, v_defaults.final_question_set_id);

  update live_quiz_defaults
  set questions_total = case when v_selected_quiz then least(questions_total, v_quiz_remaining) else questions_total end,
      duel_rounds_total = case when v_selected_duel then least(duel_rounds_total, v_duel_remaining) else duel_rounds_total end,
      final_rounds_total = case when v_selected_final then least(coalesce(final_rounds_total, duel_rounds_total), v_final_remaining) else final_rounds_total end,
      updated_at = now()
  where id = true;

  v_used := exists (select 1 from live_quiz_rounds where question_id = p_question_id)
    or exists (select 1 from duel_rounds where question_id = p_question_id)
    or exists (select 1 from individual_answers where question_id = p_question_id);

  if v_used then
    update questions set status = 'archived', updated_at = now() where id = p_question_id;
  else
    delete from questions where id = p_question_id;
  end if;

  select active_live_quiz_session_id into v_current_id from game_control where id = true;
  if v_current_id is not null then
    update live_quiz_sessions s
    set questions_total = d.questions_total,
        duel_rounds_total = d.duel_rounds_total,
        final_rounds_total = d.final_rounds_total,
        updated_at = now()
    from live_quiz_defaults d
    where d.id = true and s.id = v_current_id and s.flow_state = 'lobby';
  end if;

  return presenter_get_dynamic_config();
end;
$$;

grant execute on function presenter_delete_dynamic_question(uuid) to anon, authenticated;

create or replace function presenter_restore_dynamic_question(p_question_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update questions
  set status = 'active',
      modes = array['individual','duel','live_quiz']::game_mode[],
      updated_at = now()
  where id = p_question_id and type <> 'tiebreaker';

  if not found then raise exception 'Pergunta não encontrada'; end if;
  return presenter_get_dynamic_config();
end;
$$;

grant execute on function presenter_restore_dynamic_question(uuid) to anon, authenticated;

-- Novas sessões passam a herdar toda a configuração operacional, não apenas o tempo.
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
    final_question_set_id, final_rounds_total,
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
    v_defaults.final_question_set_id, coalesce(v_defaults.final_rounds_total, v_defaults.duel_rounds_total),
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
