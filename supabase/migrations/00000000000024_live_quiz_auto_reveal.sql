-- Extrai a lógica de revelar uma rodada do quiz coletivo para uma função
-- interna reutilizável, e liga "todos responderam" a ela diretamente —
-- antes disso só encerrava o cronômetro (phase='time_up'), ainda exigindo
-- um clique manual em "Revelar resposta" mesmo com todo mundo já
-- respondido. Sem grant para anon/authenticated: só é chamada internamente
-- por outras funções SECURITY DEFINER (submit_live_quiz_answer,
-- presenter_reveal_live_quiz_answer), nunca diretamente pelo cliente.
create function reveal_live_quiz_round(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round live_quiz_rounds%rowtype;
  v_participant record;
begin
  select * into v_round from live_quiz_rounds where id = p_round_id for update;
  if not found or v_round.revealed_at is not null then
    return;
  end if;

  if v_round.is_tiebreaker then
    for v_participant in
      select unnest(v_round.tiebreak_participant_ids) as id
    loop
      if not exists (select 1 from live_quiz_answers where round_id = v_round.id and participant_id = v_participant.id) then
        insert into live_quiz_answers (round_id, participant_id, option_id, is_correct, is_late, response_time_ms, points_awarded)
        values (v_round.id, v_participant.id, null, false, true, v_round.timer_duration_seconds * 1000, 0);
      end if;
    end loop;

    update live_quiz_rounds set revealed_at = now(), phase = 'tiebreaker_reveal' where id = v_round.id;
    update live_quiz_sessions set phase = 'tiebreaker_reveal' where id = v_round.session_id;
  else
    for v_participant in
      select id from live_quiz_participants where session_id = v_round.session_id and connected and not is_spectator
    loop
      if not exists (select 1 from live_quiz_answers where round_id = v_round.id and participant_id = v_participant.id) then
        insert into live_quiz_answers (round_id, participant_id, option_id, is_correct, is_late, response_time_ms, points_awarded)
        values (v_round.id, v_participant.id, null, false, true, v_round.timer_duration_seconds * 1000, 0);
      end if;
    end loop;

    update live_quiz_rounds set revealed_at = now(), phase = 'result_revealed' where id = v_round.id;
    update live_quiz_sessions set phase = 'result_revealed' where id = v_round.session_id;

    update live_quiz_participants lp
    set total_score = lp.total_score + la.points_awarded,
        correct_count = lp.correct_count + (case when la.is_correct then 1 else 0 end),
        current_streak = case when la.is_correct then lp.current_streak + 1 else 0 end,
        best_streak = greatest(lp.best_streak, case when la.is_correct then lp.current_streak + 1 else 0 end)
    from live_quiz_answers la
    where la.round_id = v_round.id and la.participant_id = lp.id;
  end if;

  perform log_audit('reveal_answer', 'live_quiz_rounds', v_round.id, null);
end;
$$;

create or replace function presenter_reveal_live_quiz_answer(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_number int;
  v_round_id uuid;
  v_revealed_at timestamptz;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;
  select id, revealed_at into v_round_id, v_revealed_at from live_quiz_rounds
  where session_id = p_session_id and round_number = v_round_number and not voided for update;

  if v_round_id is null then
    raise exception 'Nenhuma rodada ativa para revelar';
  end if;
  if v_revealed_at is not null then
    raise exception 'Esta rodada já foi revelada';
  end if;

  perform reveal_live_quiz_round(v_round_id);
end;
$$;

grant execute on function presenter_reveal_live_quiz_answer(uuid) to authenticated;

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

  select * into v_session from live_quiz_sessions where id = v_round.session_id;
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
    select count(*) = (select count(*) from live_quiz_participants where session_id = v_round.session_id and connected and not is_spectator)
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
