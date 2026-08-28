-- Reserva uma janela visual curta para "Todos responderam" antes do reveal.
-- A rodada já é revelada atomicamente, mas o deadline recebe +1s apenas no
-- encerramento antecipado. A camada visual usa esse segundo para a confirmação
-- e mantém os reveal_seconds completos depois dela.

create or replace function public.submit_live_quiz_answer(
  p_round_id uuid,
  p_participant_id uuid,
  p_join_token uuid,
  p_option_id uuid
)
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
  v_expected int := 0;
  v_answered int := 0;
  v_ended_early boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  if not exists (
    select 1 from live_quiz_participant_secrets
    where participant_id = p_participant_id and join_token = p_join_token
  ) then
    raise exception 'Sessão de participante inválida — recarregue a página e entre novamente';
  end if;

  select * into v_round
  from live_quiz_rounds
  where id = p_round_id
  for update;

  if not found then raise exception 'Rodada não encontrada'; end if;

  select * into v_session
  from live_quiz_sessions
  where id = v_round.session_id
  for update;

  if v_session.paused then raise exception 'A dinâmica está pausada'; end if;
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
  v_elapsed_ms := v_round.timer_accumulated_ms + extract(epoch from (v_now - v_round.timer_started_at)) * 1000;
  v_is_late := v_elapsed_ms > (v_total_ms + 1500);

  if v_is_late then
    v_is_correct := false;
  else
    select is_correct into v_is_correct
    from question_options
    where id = p_option_id and question_id = v_round.question_id;
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

  insert into live_quiz_answers (
    round_id, participant_id, option_id, is_correct,
    is_late, response_time_ms, points_awarded
  ) values (
    p_round_id,
    p_participant_id,
    case when v_is_late then null else p_option_id end,
    v_is_correct,
    v_is_late,
    least(v_elapsed_ms, v_total_ms)::int,
    v_points
  );

  if v_session.end_when_all_answered then
    if v_round.is_tiebreaker then
      v_expected := coalesce(cardinality(v_round.tiebreak_participant_ids), 0);
      select count(*) into v_answered
      from live_quiz_answers
      where round_id = p_round_id
        and participant_id = any(v_round.tiebreak_participant_ids);
    else
      select count(*) into v_expected
      from live_quiz_participants
      where session_id = v_round.session_id
        and connected
        and not is_spectator;

      select count(*) into v_answered
      from live_quiz_answers
      where round_id = p_round_id;
    end if;

    if v_expected > 0 and v_answered >= v_expected then
      perform reveal_live_quiz_round(p_round_id);

      update live_quiz_sessions
      set flow_state = 'reveal',
          phase = 'result_revealed',
          -- 1s exclusivo para a confirmação visual + reveal_seconds completos.
          flow_deadline_at = v_now + make_interval(secs => greatest(1, coalesce(reveal_seconds, 5)) + 1),
          updated_at = v_now
      where id = v_round.session_id
        and flow_state = 'question';

      v_ended_early := true;
    end if;
  end if;

  return json_build_object(
    'recorded', true,
    'endedEarly', v_ended_early,
    'answered', v_answered,
    'expected', v_expected
  );
end;
$$;

grant execute on function public.submit_live_quiz_answer(uuid, uuid, uuid, uuid) to anon, authenticated;
