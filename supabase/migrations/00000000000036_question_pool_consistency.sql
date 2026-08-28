-- Mantém as quantidades das etapas compatíveis quando uma pergunta é editada
-- e muda de banco (quiz / semifinal / final).

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
  v_quiz_count int;
  v_duel_count int;
  v_final_count int;
  v_current_id uuid;
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

  if not p_use_in_quiz and not p_use_in_semifinal and not p_use_in_final then
    raise exception 'Escolha pelo menos uma etapa em que a pergunta será usada';
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

  select count(*) into v_quiz_count from question_set_items where question_set_id = v_quiz_set;
  select count(*) into v_duel_count from question_set_items where question_set_id = v_duel_set;
  select count(*) into v_final_count from question_set_items where question_set_id = v_final_set;

  if v_quiz_count = 0 then raise exception 'O quiz precisa manter pelo menos uma pergunta'; end if;
  if v_duel_count = 0 then raise exception 'As semifinais precisam manter pelo menos uma pergunta'; end if;
  if v_final_count = 0 then raise exception 'A final precisa manter pelo menos uma pergunta'; end if;

  update live_quiz_defaults
  set question_set_id = v_quiz_set,
      duel_question_set_id = v_duel_set,
      final_question_set_id = v_final_set,
      questions_total = least(questions_total, v_quiz_count),
      duel_rounds_total = least(duel_rounds_total, v_duel_count),
      final_rounds_total = least(coalesce(final_rounds_total, duel_rounds_total), v_final_count),
      updated_at = now()
  where id = true;

  select active_live_quiz_session_id into v_current_id from game_control where id = true;
  if v_current_id is not null then
    update live_quiz_sessions s
    set question_set_id = d.question_set_id,
        duel_question_set_id = d.duel_question_set_id,
        final_question_set_id = d.final_question_set_id,
        questions_total = d.questions_total,
        duel_rounds_total = d.duel_rounds_total,
        final_rounds_total = d.final_rounds_total,
        updated_at = now()
    from live_quiz_defaults d
    where d.id = true and s.id = v_current_id and s.flow_state = 'lobby';
  end if;

  return presenter_get_dynamic_config();
end;
$$;

grant execute on function presenter_upsert_dynamic_question(uuid, text, text, jsonb, boolean, boolean, boolean) to anon, authenticated;
