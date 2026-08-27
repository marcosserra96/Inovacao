-- Dinâmica única + automação da etapa 1 (quiz coletivo)
--
-- Objetivos desta migration:
-- 1) o apresentador trabalha sempre com uma única dinâmica ativa;
-- 2) "Iniciar dinâmica" prepara/reaproveita a sessão atual e a coloca no Lobby;
-- 3) "Iniciar Quiz" dispara Prepare-se (3s) -> pergunta -> revelação -> ranking -> próxima pergunta;
-- 4) a pausa é global e congela também prepare/revelação/ranking, não só o cronômetro;
-- 5) a classificação do participante continua oculta por padrão.
--
-- As migrations 1..27 são preservadas. Esta camada usa live_quiz_sessions como
-- evento-pai para minimizar risco e manter compatibilidade com o modelo atual.

alter table live_quiz_sessions
  add column flow_state text not null default 'lobby',
  add column flow_deadline_at timestamptz,
  add column flow_remaining_ms bigint,
  add column paused_from_flow_state text,
  add column prepare_seconds int not null default 3 check (prepare_seconds between 1 and 10),
  add column reveal_seconds int not null default 3 check (reveal_seconds between 1 and 30),
  add column ranking_seconds int not null default 3 check (ranking_seconds between 1 and 30),
  add column participant_ranking_visible boolean not null default false;

alter table live_quiz_sessions
  add constraint live_quiz_sessions_flow_state_check
  check (flow_state in (
    'lobby',
    'prepare',
    'question',
    'reveal',
    'ranking',
    'quiz_result',
    'semifinal_ready',
    'semifinal',
    'semifinal_result',
    'final_ready',
    'final',
    'champion'
  ));

comment on column live_quiz_sessions.flow_state is
  'Estado canônico da experiência. As telas derivam deste campo; phase permanece por compatibilidade com as RPCs existentes.';
comment on column live_quiz_sessions.flow_deadline_at is
  'Instante servidor em que a etapa automática atual deve avançar. Nulo em estados manuais ou durante pausa.';
comment on column live_quiz_sessions.flow_remaining_ms is
  'Tempo restante congelado pela pausa global; usado para retomar exatamente do mesmo ponto.';
comment on column live_quiz_sessions.participant_ranking_visible is
  'Controla se o participante pode ver sua colocação durante a dinâmica. Padrão false; resultado final é tratado separadamente.';

-- Converte sessões existentes para um estado razoável sem alterar sua phase.
update live_quiz_sessions
set flow_state = case
  when phase = 'lobby' then 'lobby'
  when phase in ('ready', 'question_shown') then 'prepare'
  when phase in ('awaiting_answers', 'time_up') then 'question'
  when phase = 'result_revealed' then 'reveal'
  when phase = 'ranking' then 'ranking'
  when phase in ('quiz_finished', 'finalists_reveal', 'duel_ready') then 'quiz_result'
  when phase = 'duel_semifinals' then 'semifinal'
  when phase = 'duel_final' then 'final'
  else 'lobby'
end;

-- Cria/reaproveita a rodada correspondente a current_question_number sem
-- expor a pergunta ainda. A exibição é comandada por flow_state.
create function ensure_auto_live_quiz_round(p_session_id uuid)
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
  if not found then
    raise exception 'Dinâmica não encontrada';
  end if;

  select id into v_round_id
  from live_quiz_rounds
  where session_id = p_session_id
    and round_number = v_session.current_question_number
    and not voided
  order by created_at desc
  limit 1;

  if v_round_id is not null then
    return v_round_id;
  end if;

  select q.id into v_question_id
  from question_set_items qsi
  join questions q on q.id = qsi.question_id
  where qsi.question_set_id = v_session.question_set_id
    and q.status = 'active'
    and q.type <> 'tiebreaker'
    and 'live_quiz' = any(q.modes)
    and q.id not in (
      select question_id
      from live_quiz_rounds
      where session_id = p_session_id
        and question_id is not null
        and not voided
    )
  order by random()
  limit 1;

  if v_question_id is null then
    raise exception 'Não há mais perguntas disponíveis neste conjunto para o quiz';
  end if;

  insert into live_quiz_rounds (
    session_id,
    round_number,
    question_id,
    phase,
    timer_duration_seconds,
    timer_started_at,
    timer_paused_at,
    timer_accumulated_ms
  )
  values (
    p_session_id,
    v_session.current_question_number,
    v_question_id,
    'question_shown',
    coalesce((select time_limit_seconds from questions where id = v_question_id), 20),
    null,
    null,
    0
  )
  returning id into v_round_id;

  return v_round_id;
end;
$$;

-- Único ponto de entrada operacional do evento. Se já existe uma dinâmica
-- ativa, devolve a mesma em vez de criar outra sessão visível.
create function presenter_prepare_current_dynamic(p_name text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_id uuid;
  v_current live_quiz_sessions%rowtype;
  v_created json;
  v_session_id uuid;
  v_code text;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;

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

  v_created := presenter_start_live_quiz_from_defaults(p_name);
  v_session_id := (v_created ->> 'sessionId')::uuid;
  v_code := v_created ->> 'code';

  update live_quiz_sessions
  set flow_state = 'lobby',
      flow_deadline_at = null,
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      paused = false,
      participant_ranking_visible = false,
      lobby_locked = false,
      updated_at = now()
  where id = v_session_id;

  update game_control
  set active_mode = 'live_quiz',
      active_live_quiz_session_id = v_session_id,
      active_individual_session_id = null,
      active_duel_match_id = null,
      updated_at = now()
  where id = true;

  perform log_audit('prepare_current_dynamic', 'live_quiz_sessions', v_session_id, null);

  return json_build_object(
    'sessionId', v_session_id,
    'code', v_code,
    'reused', false,
    'flowState', 'lobby'
  );
end;
$$;

grant execute on function presenter_prepare_current_dynamic(text) to authenticated;

-- Encerra logicamente a dinâmica anterior e prepara outra a partir dos
-- defaults, mantendo o histórico no banco sem expor "sessões" ao operador.
create function presenter_prepare_new_dynamic(p_name text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;

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

grant execute on function presenter_prepare_new_dynamic(text) to authenticated;

-- Inicia somente a etapa do quiz. O telão já deve estar aberto no Lobby.
create function presenter_start_auto_live_quiz(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_round_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
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
  perform log_audit('start_auto_live_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('roundId', v_round_id));

  return json_build_object('started', true, 'flowState', 'prepare', 'roundId', v_round_id);
end;
$$;

grant execute on function presenter_start_auto_live_quiz(uuid) to authenticated;

-- Avança o relógio da máquina de estados. É seguro chamar repetidamente de
-- qualquer tela: a função trava a sessão, verifica o relógio do servidor e
-- só avança quando necessário. Assim o navegador não é a fonte da verdade.
create function tick_live_quiz_flow(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_round live_quiz_rounds%rowtype;
  v_round_id uuid;
  v_now timestamptz := now();
  v_next int;
begin
  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Dinâmica não encontrada';
  end if;

  if v_session.paused then
    return json_build_object('flowState', v_session.flow_state, 'paused', true, 'deadlineAt', null);
  end if;

  -- Se todos responderam, reveal_live_quiz_round pode ter revelado antes do
  -- prazo. Sincroniza flow_state imediatamente e garante o tempo inteiro da
  -- tela de revelação.
  if v_session.flow_state = 'question' then
    select * into v_round
    from live_quiz_rounds
    where session_id = p_session_id
      and round_number = v_session.current_question_number
      and not voided
    order by created_at desc
    limit 1;

    if found and v_round.revealed_at is not null then
      update live_quiz_sessions
      set flow_state = 'reveal',
          phase = 'result_revealed',
          flow_deadline_at = v_now + make_interval(secs => reveal_seconds),
          updated_at = v_now
      where id = p_session_id;

      select * into v_session from live_quiz_sessions where id = p_session_id;
    end if;
  end if;

  if v_session.flow_deadline_at is null or v_session.flow_deadline_at > v_now then
    return json_build_object(
      'flowState', v_session.flow_state,
      'paused', false,
      'deadlineAt', v_session.flow_deadline_at
    );
  end if;

  if v_session.flow_state = 'prepare' then
    v_round_id := ensure_auto_live_quiz_round(p_session_id);

    update live_quiz_rounds
    set phase = 'awaiting_answers',
        timer_started_at = v_now,
        timer_paused_at = null,
        timer_accumulated_ms = 0
    where id = v_round_id;

    update live_quiz_sessions s
    set flow_state = 'question',
        phase = 'awaiting_answers',
        flow_deadline_at = v_now + make_interval(secs => (
          select timer_duration_seconds from live_quiz_rounds where id = v_round_id
        )),
        updated_at = v_now
    where s.id = p_session_id;

  elsif v_session.flow_state = 'question' then
    select * into v_round
    from live_quiz_rounds
    where session_id = p_session_id
      and round_number = v_session.current_question_number
      and not voided
    order by created_at desc
    limit 1;

    if found and v_round.revealed_at is null then
      perform reveal_live_quiz_round(v_round.id);
    end if;

    update live_quiz_sessions
    set flow_state = 'reveal',
        phase = 'result_revealed',
        flow_deadline_at = v_now + make_interval(secs => reveal_seconds),
        updated_at = v_now
    where id = p_session_id;

  elsif v_session.flow_state = 'reveal' then
    if v_session.current_question_number >= v_session.questions_total then
      update live_quiz_sessions
      set flow_state = 'quiz_result',
          phase = 'quiz_finished',
          flow_deadline_at = null,
          participant_ranking_visible = false,
          updated_at = v_now
      where id = p_session_id;
    elsif v_session.show_ranking_after_question then
      update live_quiz_sessions
      set flow_state = 'ranking',
          phase = 'ranking',
          flow_deadline_at = v_now + make_interval(secs => ranking_seconds),
          updated_at = v_now
      where id = p_session_id;
    else
      v_next := v_session.current_question_number + 1;
      update live_quiz_sessions
      set current_question_number = v_next,
          flow_state = 'prepare',
          phase = 'ready',
          flow_deadline_at = v_now + make_interval(secs => prepare_seconds),
          updated_at = v_now
      where id = p_session_id;
      perform ensure_auto_live_quiz_round(p_session_id);
    end if;

  elsif v_session.flow_state = 'ranking' then
    v_next := v_session.current_question_number + 1;

    if v_next > v_session.questions_total then
      update live_quiz_sessions
      set flow_state = 'quiz_result',
          phase = 'quiz_finished',
          flow_deadline_at = null,
          participant_ranking_visible = false,
          updated_at = v_now
      where id = p_session_id;
    else
      update live_quiz_sessions
      set current_question_number = v_next,
          flow_state = 'prepare',
          phase = 'ready',
          flow_deadline_at = v_now + make_interval(secs => prepare_seconds),
          updated_at = v_now
      where id = p_session_id;
      perform ensure_auto_live_quiz_round(p_session_id);
    end if;
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id;

  return json_build_object(
    'flowState', v_session.flow_state,
    'paused', v_session.paused,
    'deadlineAt', v_session.flow_deadline_at,
    'questionNumber', v_session.current_question_number
  );
end;
$$;

grant execute on function tick_live_quiz_flow(uuid) to anon, authenticated;

-- Pausa global: congela qualquer deadline e, se a pergunta estiver aberta,
-- também congela o cronômetro usado no cálculo de pontuação.
create function presenter_pause_current_dynamic(p_session_id uuid)
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
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Dinâmica não encontrada';
  end if;
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

  perform log_audit('pause_current_dynamic', 'live_quiz_sessions', p_session_id, jsonb_build_object('remainingMs', v_remaining_ms));

  return json_build_object('paused', true, 'flowState', v_session.flow_state, 'remainingMs', v_remaining_ms);
end;
$$;

grant execute on function presenter_pause_current_dynamic(uuid) to authenticated;

create function presenter_resume_current_dynamic(p_session_id uuid)
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
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Dinâmica não encontrada';
  end if;
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

  perform log_audit('resume_current_dynamic', 'live_quiz_sessions', p_session_id, null);

  return json_build_object('paused', false, 'flowState', v_session.flow_state, 'deadlineAt', v_deadline);
end;
$$;

grant execute on function presenter_resume_current_dynamic(uuid) to authenticated;

create function presenter_set_participant_ranking_visibility(p_session_id uuid, p_visible boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;

  update live_quiz_sessions
  set participant_ranking_visible = p_visible,
      updated_at = now()
  where id = p_session_id;

  perform log_audit('participant_ranking_visibility', 'live_quiz_sessions', p_session_id, jsonb_build_object('visible', p_visible));
end;
$$;

grant execute on function presenter_set_participant_ranking_visibility(uuid, boolean) to authenticated;

-- A pausa deve impedir novas respostas de verdade, não apenas esconder o
-- cronômetro. Substitui a versão da migration 24 acrescentando essa trava.
create or replace function submit_live_quiz_answer(p_round_id uuid, p_participant_id uuid, p_join_token uuid, p_option_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round live_quiz_rounds%rowtype;
  v_session live_quiz_sessions%rowtype;
  v_scoring scoring_configs%rowtype;
  v_question questions%rowtype;
  v_elapsed_ms bigint;
  v_total_ms bigint;
  v_is_correct boolean;
  v_is_late boolean;
  v_points int;
  v_all_answered boolean;
begin
  if not exists (
    select 1 from live_quiz_participant_secrets where participant_id = p_participant_id and join_token = p_join_token
  ) then
    raise exception 'Sessão de participante inválida — recarregue a página e entre novamente';
  end if;

  select * into v_round from live_quiz_rounds where id = p_round_id for update;
  if not found then
    raise exception 'Rodada não encontrada';
  end if;

  select * into v_session from live_quiz_sessions where id = v_round.session_id;
  if v_session.paused then
    raise exception 'A dinâmica está pausada';
  end if;

  if v_round.phase not in ('awaiting_answers', 'tiebreaker_answering') then
    raise exception 'Esta rodada não está aceitando respostas no momento';
  end if;
  if exists (select 1 from live_quiz_answers where round_id = p_round_id and participant_id = p_participant_id) then
    raise exception 'Você já respondeu esta rodada';
  end if;
  if not exists (select 1 from live_quiz_participants where id = p_participant_id and session_id = v_round.session_id) then
    raise exception 'Participante não faz parte deste quiz';
  end if;
  if v_round.is_tiebreaker and not (p_participant_id = any(v_round.tiebreak_participant_ids)) then
    raise exception 'Esta pergunta de desempate não é para você';
  end if;

  select * into v_scoring from scoring_configs where id = v_session.scoring_config_id;
  select * into v_question from questions where id = v_round.question_id;

  v_total_ms := v_round.timer_duration_seconds * 1000;
  v_elapsed_ms := v_round.timer_accumulated_ms + extract(epoch from (now() - v_round.timer_started_at)) * 1000;
  v_is_late := v_elapsed_ms > (v_total_ms + 1500);

  if v_is_late then
    v_is_correct := false;
  else
    select is_correct into v_is_correct from question_options where id = p_option_id and question_id = v_round.question_id;
    v_is_correct := coalesce(v_is_correct, false);
  end if;

  v_points := compute_points(
    v_is_correct,
    v_question.base_points,
    case when v_session.enable_speed_bonus then v_scoring.speed_bonus_max else 0 end,
    least(v_elapsed_ms, v_total_ms),
    v_total_ms,
    false, 0, 0, 0,
    v_session.enable_penalty,
    v_session.penalty_wrong
  );

  insert into live_quiz_answers (round_id, participant_id, option_id, is_correct, is_late, response_time_ms, points_awarded)
  values (p_round_id, p_participant_id, case when v_is_late then null else p_option_id end, v_is_correct, v_is_late, least(v_elapsed_ms, v_total_ms)::int, v_points);

  if v_session.end_when_all_answered and not v_round.is_tiebreaker then
    select count(*) = (
      select count(*) from live_quiz_participants
      where session_id = v_round.session_id and connected and not is_spectator
    )
    into v_all_answered
    from live_quiz_answers
    where round_id = p_round_id;

    if v_all_answered then
      perform reveal_live_quiz_round(p_round_id);
    end if;
  end if;

  return json_build_object('recorded', true);
end;
$$;

grant execute on function submit_live_quiz_answer(uuid, uuid, uuid, uuid) to anon, authenticated;
