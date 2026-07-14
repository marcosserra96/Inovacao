-- RPCs do Modo 1 (Desafio individual). Chamadas pelo cliente anônimo (anon
-- key); o attempt_id retornado funciona como capability token — só quem o
-- recebeu consegue submeter respostas para aquela tentativa. Toda leitura de
-- pergunta/alternativa passa por aqui, nunca por select direto nas tabelas.

create function build_question_payload(p_question_id uuid, p_option_ids uuid[], p_reveal boolean default false)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'questionId', q.id,
    'statement', q.statement,
    'type', q.type,
    'mediaUrl', q.media_url,
    'timeLimitSeconds', q.time_limit_seconds,
    'explanation', case when p_reveal then q.explanation else null end,
    'options', (
      select json_agg(json_build_object(
        'optionId', qo.id,
        'text', qo.text,
        'isCorrect', case when p_reveal then qo.is_correct else null end
      ) order by array_position(p_option_ids, qo.id))
      from question_options qo
      where qo.id = any(p_option_ids)
    )
  )
  from questions q
  where q.id = p_question_id;
$$;

create function start_individual_attempt(
  p_session_id uuid,
  p_display_name text,
  p_team text default null,
  p_device_fingerprint text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session individual_sessions%rowtype;
  v_participant_id uuid;
  v_attempt_id uuid;
  v_question_ids uuid[];
  v_option_order jsonb := '{}';
  v_qid uuid;
  v_opts uuid[];
  v_first_question json;
begin
  select * into v_session from individual_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sessão não encontrada';
  end if;
  if v_session.status <> 'open' or now() < coalesce(v_session.opens_at, now()) or now() > coalesce(v_session.closes_at, now() + interval '100 years') then
    raise exception 'Esta sessão não está aberta para participação no momento';
  end if;
  if v_session.require_identification and coalesce(trim(p_display_name), '') = '' then
    raise exception 'Informe seu nome para participar';
  end if;

  if not v_session.allow_retry and p_device_fingerprint is not null then
    if exists (
      select 1
      from individual_attempts ia
      join participants p on p.id = ia.participant_id
      where ia.session_id = p_session_id
        and p.device_fingerprint = p_device_fingerprint
        and ia.status = 'finished'
    ) then
      raise exception 'Você já participou desta dinâmica';
    end if;
  end if;

  insert into participants (session_id, display_name, team, device_fingerprint)
  values (p_session_id, nullif(trim(p_display_name), ''), p_team, p_device_fingerprint)
  returning id into v_participant_id;

  with picked as (
    select
      qsi.question_id,
      row_number() over (
        order by case when v_session.question_order = 'random' then random() else qsi.position::float end
      ) as rn
    from question_set_items qsi
    join questions q on q.id = qsi.question_id
    where qsi.question_set_id = v_session.question_set_id
      and q.status = 'active'
      and 'individual' = any(q.modes)
    order by case when v_session.question_order = 'random' then random() else qsi.position::float end
    limit v_session.question_count
  )
  select array_agg(question_id order by rn) into v_question_ids from picked;

  if v_question_ids is null or array_length(v_question_ids, 1) = 0 then
    raise exception 'Nenhuma pergunta disponível para esta sessão';
  end if;

  foreach v_qid in array v_question_ids loop
    if v_session.shuffle_options then
      select array_agg(id order by random()) into v_opts from question_options where question_id = v_qid;
    else
      select array_agg(id order by position) into v_opts from question_options where question_id = v_qid;
    end if;
    v_option_order := v_option_order || jsonb_build_object(v_qid::text, to_jsonb(v_opts));
  end loop;

  insert into individual_attempts (session_id, participant_id, question_ids, option_order, current_index, current_question_started_at)
  values (p_session_id, v_participant_id, v_question_ids, v_option_order, 0, now())
  returning id into v_attempt_id;

  v_first_question := build_question_payload(
    v_question_ids[1],
    array(select jsonb_array_elements_text(v_option_order -> v_question_ids[1]::text)::uuid)
  );

  return json_build_object(
    'attemptId', v_attempt_id,
    'participantId', v_participant_id,
    'totalQuestions', array_length(v_question_ids, 1),
    'currentIndex', 0,
    'question', v_first_question
  );
end;
$$;

grant execute on function start_individual_attempt(uuid, text, text, text) to anon, authenticated;

-- Recupera a pergunta atual de uma tentativa em andamento — usado ao montar
-- a tela e ao reconectar após queda de conexão/atualização de página.
create function get_current_individual_question(p_attempt_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attempt individual_attempts%rowtype;
  v_qid uuid;
  v_opts uuid[];
  v_elapsed_ms bigint;
begin
  select * into v_attempt from individual_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Tentativa não encontrada';
  end if;

  if v_attempt.status = 'finished' then
    return json_build_object('status', 'finished', 'attemptId', v_attempt.id);
  end if;

  v_qid := v_attempt.question_ids[v_attempt.current_index + 1];
  v_opts := array(select jsonb_array_elements_text(v_attempt.option_order -> v_qid::text)::uuid);
  v_elapsed_ms := extract(epoch from (now() - v_attempt.current_question_started_at)) * 1000;

  return json_build_object(
    'status', 'in_progress',
    'attemptId', v_attempt.id,
    'totalQuestions', array_length(v_attempt.question_ids, 1),
    'currentIndex', v_attempt.current_index,
    'elapsedMs', v_elapsed_ms,
    'question', build_question_payload(v_qid, v_opts)
  );
end;
$$;

grant execute on function get_current_individual_question(uuid) to anon, authenticated;

create function submit_individual_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt individual_attempts%rowtype;
  v_session individual_sessions%rowtype;
  v_scoring scoring_configs%rowtype;
  v_question questions%rowtype;
  v_expected_qid uuid;
  v_effective_limit_seconds int;
  v_elapsed_ms bigint;
  v_total_ms bigint;
  v_is_correct boolean;
  v_is_late boolean;
  v_streak int := 0;
  v_points int;
  v_next_index int;
  v_finished boolean := false;
  v_next_question json := null;
begin
  select * into v_attempt from individual_attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'Tentativa não encontrada';
  end if;
  if v_attempt.status = 'finished' then
    raise exception 'Esta tentativa já foi encerrada';
  end if;

  v_expected_qid := v_attempt.question_ids[v_attempt.current_index + 1];
  if v_expected_qid is distinct from p_question_id then
    raise exception 'Pergunta inesperada — recarregue a página';
  end if;
  if exists (select 1 from individual_answers where attempt_id = p_attempt_id and question_id = p_question_id) then
    raise exception 'Esta pergunta já foi respondida';
  end if;

  select * into v_session from individual_sessions where id = v_attempt.session_id;
  select * into v_scoring from scoring_configs where id = v_session.scoring_config_id;
  select * into v_question from questions where id = p_question_id;

  v_effective_limit_seconds := coalesce(v_session.time_limit_seconds, v_question.time_limit_seconds);
  v_total_ms := v_effective_limit_seconds * 1000;
  v_elapsed_ms := extract(epoch from (now() - v_attempt.current_question_started_at)) * 1000;
  -- margem de tolerância de rede: 1.5s além do tempo nominal
  v_is_late := v_elapsed_ms > (v_total_ms + 1500);

  if v_is_late then
    v_is_correct := false;
  else
    select is_correct into v_is_correct from question_options where id = p_option_id and question_id = p_question_id;
    v_is_correct := coalesce(v_is_correct, false);
  end if;

  if v_is_correct then
    select count(*) into v_streak
    from (
      select is_correct
      from individual_answers
      where attempt_id = p_attempt_id
      order by answered_at desc
    ) recent
    where is_correct;
    v_streak := v_streak + 1;
  end if;

  v_points := compute_points(
    v_is_correct,
    v_question.base_points,
    v_scoring.speed_bonus_max,
    least(v_elapsed_ms, v_total_ms),
    v_total_ms,
    v_scoring.enable_streak_bonus,
    v_streak,
    v_scoring.streak_bonus,
    v_scoring.streak_bonus_cap,
    v_scoring.enable_penalty,
    v_scoring.penalty_wrong
  );

  insert into individual_answers (attempt_id, question_id, option_id, is_correct, is_late, answer_time_ms, points_awarded)
  values (p_attempt_id, p_question_id, case when v_is_late then null else p_option_id end, v_is_correct, v_is_late, least(v_elapsed_ms, v_total_ms)::int, v_points);

  v_next_index := v_attempt.current_index + 1;
  v_finished := v_next_index >= array_length(v_attempt.question_ids, 1);

  update individual_attempts set
    current_index = v_next_index,
    current_question_started_at = case when v_finished then null else now() end,
    total_score = total_score + v_points,
    correct_count = correct_count + (case when v_is_correct then 1 else 0 end),
    total_time_ms = total_time_ms + least(v_elapsed_ms, v_total_ms)::bigint,
    finished_at = case when v_finished then now() else finished_at end,
    status = case when v_finished then 'finished' else status end
  where id = p_attempt_id;

  if not v_finished then
    v_next_question := build_question_payload(
      v_attempt.question_ids[v_next_index + 1],
      array(select jsonb_array_elements_text(v_attempt.option_order -> v_attempt.question_ids[v_next_index + 1]::text)::uuid)
    );
  end if;

  return json_build_object(
    'isCorrect', v_is_correct,
    'isLate', v_is_late,
    'pointsAwarded', v_points,
    'correctOptionId', case when v_session.show_correct_answer then (select id from question_options where question_id = p_question_id and is_correct limit 1) else null end,
    'explanation', case when v_session.show_correct_answer then v_question.explanation else null end,
    'finished', v_finished,
    'nextQuestion', v_next_question
  );
end;
$$;

grant execute on function submit_individual_answer(uuid, uuid, uuid) to anon, authenticated;
