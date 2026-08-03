-- RPCs do quiz coletivo ao vivo. Espelham as RPCs do duelo (mesma máquina
-- de estados, mesmo padrão de segurança), generalizadas para N
-- participantes, mais a promoção automática dos 2 finalistas para um
-- duel_match real ao final — sem exigir novo cadastro do celular deles.

-- Classificação do quiz coletivo, com os critérios de desempate da seção 6
-- do briefing: pontuação, acertos, tempo médio nas respostas corretas
-- (rodadas normais só — desempate por pergunta extra é resolvido à parte,
-- em presenter_select_live_quiz_finalists) e, por fim, ordem de entrada
-- como critério estável final. Nunca filtra por is_spectator: precisa
-- continuar mostrando todo mundo mesmo depois dos finalistas definidos,
-- para o apresentador poder recalcular/corrigir se precisar.
create view v_live_quiz_ranking as
with correct_avg as (
  select la.participant_id, avg(la.response_time_ms) as avg_ms
  from live_quiz_answers la
  join live_quiz_rounds lr on lr.id = la.round_id
  where la.is_correct and not lr.is_tiebreaker
  group by la.participant_id
)
select
  lp.session_id,
  lp.id as participant_id,
  lp.display_name,
  lp.team,
  lp.total_score,
  lp.correct_count,
  lp.best_streak,
  lp.is_finalist,
  lp.is_spectator,
  ca.avg_ms as avg_correct_response_ms,
  rank() over (
    partition by lp.session_id
    order by lp.total_score desc, lp.correct_count desc, coalesce(ca.avg_ms, 2147483647) asc, lp.joined_at asc
  ) as rank
from live_quiz_participants lp
left join correct_avg ca on ca.participant_id = lp.id;

grant select on v_live_quiz_ranking to anon, authenticated;

-- Conteúdo público e seguro da pergunta de uma rodada: nunca expõe qual
-- alternativa é correta antes de live_quiz_rounds.revealed_at estar
-- preenchido. Reaproveita build_question_payload (00000000000009).
create function get_public_live_quiz_round_question(p_round_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round live_quiz_rounds%rowtype;
begin
  select * into v_round from live_quiz_rounds where id = p_round_id;
  if not found then
    raise exception 'Rodada não encontrada';
  end if;
  return build_question_payload(
    v_round.question_id,
    (select array_agg(id order by position) from question_options where question_id = v_round.question_id),
    v_round.revealed_at is not null
  );
end;
$$;

grant execute on function get_public_live_quiz_round_question(uuid) to anon, authenticated;

-- Resultado consolidado de uma rodada já revelada (quem acertou, pontos).
-- Retorna nulo se ainda não revelada.
create function get_live_quiz_round_result(p_round_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when lr.revealed_at is null then null else
    json_build_object(
      'roundId', lr.id,
      'revealedAt', lr.revealed_at,
      'answers', (
        select json_agg(json_build_object(
          'participantId', la.participant_id,
          'optionId', la.option_id,
          'isCorrect', la.is_correct,
          'isLate', la.is_late,
          'pointsAwarded', la.points_awarded,
          'responseTimeMs', la.response_time_ms
        ))
        from live_quiz_answers la where la.round_id = lr.id
      )
    )
  end
  from live_quiz_rounds lr where lr.id = p_round_id;
$$;

grant execute on function get_live_quiz_round_result(uuid) to anon, authenticated;

-- Entrada do participante. Se o mesmo dispositivo (device_fingerprint) já
-- participou desta sessão, restaura a identidade em vez de duplicar — é
-- assim que um F5 ou fechar/abrir o navegador não perde a participação.
create function join_live_quiz(
  p_code text,
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
  v_session live_quiz_sessions%rowtype;
  v_participant_id uuid;
  v_join_token uuid;
  v_restored boolean := false;
  v_color text;
  v_palette text[] := array['#5b21f0', '#06b6c4', '#f5a623', '#16c784', '#f0405b', '#e04fd4', '#2f6fed', '#ff6b6b'];
begin
  select * into v_session from live_quiz_sessions where upper(code) = upper(p_code);
  if not found then
    raise exception 'Código inválido';
  end if;
  if v_session.status in ('finished', 'cancelled') then
    raise exception 'Este quiz já foi encerrado';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Informe seu nome para entrar';
  end if;

  if p_device_fingerprint is not null then
    select id into v_participant_id
    from live_quiz_participants
    where session_id = v_session.id and device_fingerprint = p_device_fingerprint;
  end if;

  if v_participant_id is not null then
    update live_quiz_participants
    set connected = true, left_at = null, display_name = trim(p_display_name), team = coalesce(nullif(trim(p_team), ''), team)
    where id = v_participant_id;
    v_restored := true;
    select join_token into v_join_token from live_quiz_participant_secrets where participant_id = v_participant_id;
  else
    if v_session.lobby_locked then
      raise exception 'Este quiz não está aceitando novas entradas no momento';
    end if;

    v_color := v_palette[1 + (select count(*) from live_quiz_participants where session_id = v_session.id) % array_length(v_palette, 1)];

    insert into live_quiz_participants (session_id, display_name, team, device_fingerprint, avatar_color)
    values (v_session.id, trim(p_display_name), nullif(trim(p_team), ''), p_device_fingerprint, v_color)
    returning id into v_participant_id;

    insert into live_quiz_participant_secrets (participant_id) values (v_participant_id)
    returning join_token into v_join_token;
  end if;

  return json_build_object(
    'sessionId', v_session.id,
    'participantId', v_participant_id,
    'joinToken', v_join_token,
    'code', v_session.code,
    'restored', v_restored
  );
end;
$$;

grant execute on function join_live_quiz(text, text, text, text) to anon, authenticated;

-- Se o participante foi promovido a finalista, devolve a identidade dele no
-- duel_match criado automaticamente — permite ao mesmo celular (mesma
-- sessão local, mesmo join_token do quiz) trocar de tela sozinho, sem
-- reentrar em lugar nenhum.
create function get_my_live_quiz_promotion(p_participant_id uuid, p_join_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_participant live_quiz_participants%rowtype;
  v_duel_join_token uuid;
begin
  if not exists (
    select 1 from live_quiz_participant_secrets
    where participant_id = p_participant_id and join_token = p_join_token
  ) then
    raise exception 'Sessão inválida — recarregue a página e entre novamente';
  end if;

  select * into v_participant from live_quiz_participants where id = p_participant_id;
  if v_participant.promoted_duel_player_id is null then
    return json_build_object('promoted', false);
  end if;

  select join_token into v_duel_join_token
  from duel_player_secrets where player_id = v_participant.promoted_duel_player_id;

  return json_build_object(
    'promoted', true,
    'duelMatchId', (select match_id from duel_players where id = v_participant.promoted_duel_player_id),
    'duelPlayerId', v_participant.promoted_duel_player_id,
    'duelJoinToken', v_duel_join_token
  );
end;
$$;

grant execute on function get_my_live_quiz_promotion(uuid, uuid) to anon, authenticated;

create function presenter_open_live_quiz_lobby(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_sessions set status = 'lobby', phase = 'lobby', presenter_id = coalesce(presenter_id, auth.uid())
  where id = p_session_id and status = 'draft';
  perform log_audit('open_lobby', 'live_quiz_sessions', p_session_id, null);
end;
$$;

grant execute on function presenter_open_live_quiz_lobby(uuid) to authenticated;

create function presenter_lock_live_quiz_lobby(p_session_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_sessions set lobby_locked = p_locked where id = p_session_id;
  perform log_audit('lock_lobby', 'live_quiz_sessions', p_session_id, jsonb_build_object('locked', p_locked));
end;
$$;

grant execute on function presenter_lock_live_quiz_lobby(uuid, boolean) to authenticated;

create function presenter_show_live_quiz_rules(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_sessions set phase = 'rules' where id = p_session_id;
end;
$$;

grant execute on function presenter_show_live_quiz_rules(uuid) to authenticated;

create function presenter_start_live_quiz(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  if (select count(*) from live_quiz_participants where session_id = p_session_id and connected) = 0 then
    raise exception 'Nenhum participante conectado ainda';
  end if;

  update live_quiz_sessions
  set status = 'in_progress', phase = 'ready', current_question_number = 1, started_at = now()
  where id = p_session_id;

  perform log_audit('start_live_quiz', 'live_quiz_sessions', p_session_id, null);
end;
$$;

grant execute on function presenter_start_live_quiz(uuid) to authenticated;

-- Libera a próxima pergunta no telão/celulares (cria o registro da rodada
-- se ainda não existir) sem iniciar o cronômetro. Idempotente: reexecutar
-- para o mesmo current_question_number reaproveita a rodada já criada em
-- vez de sortear outra pergunta ou duplicar a linha.
create function presenter_show_live_quiz_question(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_round_id uuid;
  v_question_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_session from live_quiz_sessions where id = p_session_id for update;

  select id into v_round_id from live_quiz_rounds
  where session_id = p_session_id and round_number = v_session.current_question_number and not voided;

  if v_round_id is null then
    select q.id into v_question_id
    from question_set_items qsi
    join questions q on q.id = qsi.question_id
    where qsi.question_set_id = v_session.question_set_id
      and q.status = 'active'
      and q.type <> 'tiebreaker'
      and 'live_quiz' = any(q.modes)
      and q.id not in (
        select question_id from live_quiz_rounds where session_id = p_session_id and question_id is not null
      )
    order by random()
    limit 1;

    if v_question_id is null then
      raise exception 'Não há mais perguntas disponíveis neste conjunto para o quiz';
    end if;

    insert into live_quiz_rounds (session_id, round_number, question_id, phase, timer_duration_seconds)
    values (
      p_session_id,
      v_session.current_question_number,
      v_question_id,
      'question_shown',
      coalesce((select time_limit_seconds from questions where id = v_question_id), 20)
    )
    returning id into v_round_id;
  else
    update live_quiz_rounds set phase = 'question_shown' where id = v_round_id;
  end if;

  update live_quiz_sessions set phase = 'question_shown' where id = p_session_id;
  perform log_audit('show_question', 'live_quiz_rounds', v_round_id, null);

  return json_build_object('roundId', v_round_id);
end;
$$;

grant execute on function presenter_show_live_quiz_question(uuid) to authenticated;

create function presenter_start_live_quiz_timer(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id uuid;
  v_round_number int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;
  select id into v_round_id from live_quiz_rounds where session_id = p_session_id and round_number = v_round_number and not voided;

  update live_quiz_rounds
  set timer_started_at = now(), timer_paused_at = null, timer_accumulated_ms = 0,
      phase = case when is_tiebreaker then 'tiebreaker_answering'::live_quiz_phase else 'awaiting_answers'::live_quiz_phase end
  where id = v_round_id;

  update live_quiz_sessions
  set phase = (select phase from live_quiz_rounds where id = v_round_id)
  where id = p_session_id;
end;
$$;

grant execute on function presenter_start_live_quiz_timer(uuid) to authenticated;

create function presenter_pause_live_quiz_timer(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round live_quiz_rounds%rowtype;
  v_round_number int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;
  select * into v_round from live_quiz_rounds where session_id = p_session_id and round_number = v_round_number and not voided;

  if v_round.timer_started_at is not null and v_round.timer_paused_at is null then
    update live_quiz_rounds
    set timer_accumulated_ms = timer_accumulated_ms + extract(epoch from (now() - timer_started_at)) * 1000,
        timer_paused_at = now()
    where id = v_round.id;
  end if;
end;
$$;

grant execute on function presenter_pause_live_quiz_timer(uuid) to authenticated;

create function presenter_resume_live_quiz_timer(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_number int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;

  update live_quiz_rounds
  set timer_started_at = now(), timer_paused_at = null
  where session_id = p_session_id and round_number = v_round_number and not voided and timer_paused_at is not null;
end;
$$;

grant execute on function presenter_resume_live_quiz_timer(uuid) to authenticated;

-- Contingência: adiciona alguns segundos à rodada em andamento (ex.: sinal
-- de wi-fi ruim em algumas mesas). Cada celular recalcula o tempo restante
-- a partir de timer_duration_seconds, então o efeito é imediato em todos.
create function presenter_extend_live_quiz_timer(p_session_id uuid, p_extra_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_number int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  if p_extra_seconds <= 0 or p_extra_seconds > 60 then
    raise exception 'Informe entre 1 e 60 segundos extras';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;

  update live_quiz_rounds
  set timer_duration_seconds = timer_duration_seconds + p_extra_seconds
  where session_id = p_session_id and round_number = v_round_number and not voided;

  perform log_audit('extend_timer', 'live_quiz_sessions', p_session_id, jsonb_build_object('extraSeconds', p_extra_seconds));
end;
$$;

grant execute on function presenter_extend_live_quiz_timer(uuid, int) to authenticated;

-- Encerra a janela de respostas antecipadamente (sem esperar o cronômetro).
create function presenter_end_live_quiz_question_early(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_number int;
  v_is_tiebreaker boolean;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;
  select is_tiebreaker into v_is_tiebreaker from live_quiz_rounds
  where session_id = p_session_id and round_number = v_round_number and not voided;

  update live_quiz_rounds set phase = 'time_up' where session_id = p_session_id and round_number = v_round_number and not voided;
  update live_quiz_sessions set phase = 'time_up' where id = p_session_id;
end;
$$;

grant execute on function presenter_end_live_quiz_question_early(uuid) to authenticated;

create function submit_live_quiz_answer(p_round_id uuid, p_participant_id uuid, p_join_token uuid, p_option_id uuid)
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
      update live_quiz_rounds set phase = 'time_up' where id = p_round_id;
      update live_quiz_sessions set phase = 'time_up' where id = v_round.session_id;
    end if;
  end if;

  return json_build_object('recorded', true);
end;
$$;

grant execute on function submit_live_quiz_answer(uuid, uuid, uuid, uuid) to anon, authenticated;

-- Revela a resposta correta e aplica a pontuação da rodada. Participantes
-- conectados (não espectadores) que não responderam recebem um registro de
-- "sem resposta" para o resultado da rodada ficar completo e auditável.
-- Rodadas de desempate NÃO somam ao placar oficial (servem só para ordenar
-- o corte de finalistas).
create function presenter_reveal_live_quiz_answer(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round live_quiz_rounds%rowtype;
  v_round_number int;
  v_participant record;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;
  select * into v_round from live_quiz_rounds where session_id = p_session_id and round_number = v_round_number and not voided for update;
  if v_round.revealed_at is not null then
    raise exception 'Esta rodada já foi revelada';
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
    update live_quiz_sessions set phase = 'tiebreaker_reveal' where id = p_session_id;
  else
    for v_participant in
      select id from live_quiz_participants where session_id = p_session_id and connected and not is_spectator
    loop
      if not exists (select 1 from live_quiz_answers where round_id = v_round.id and participant_id = v_participant.id) then
        insert into live_quiz_answers (round_id, participant_id, option_id, is_correct, is_late, response_time_ms, points_awarded)
        values (v_round.id, v_participant.id, null, false, true, v_round.timer_duration_seconds * 1000, 0);
      end if;
    end loop;

    update live_quiz_rounds set revealed_at = now(), phase = 'result_revealed' where id = v_round.id;
    update live_quiz_sessions set phase = 'result_revealed' where id = p_session_id;

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

grant execute on function presenter_reveal_live_quiz_answer(uuid) to authenticated;

create function presenter_show_live_quiz_ranking(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_sessions set phase = 'ranking' where id = p_session_id;
end;
$$;

grant execute on function presenter_show_live_quiz_ranking(uuid) to authenticated;

-- Anula a rodada atual (não conta para o placar); o apresentador segue
-- para a próxima pergunta em seguida.
create function presenter_void_live_quiz_question(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_number int;
  v_round_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;
  select id into v_round_id from live_quiz_rounds where session_id = p_session_id and round_number = v_round_number and not voided;
  if v_round_id is null then
    raise exception 'Nenhuma rodada ativa para anular';
  end if;

  update live_quiz_rounds set voided = true, phase = 'ready' where id = v_round_id;
  update live_quiz_sessions set phase = 'ready' where id = p_session_id;

  perform log_audit('void_question', 'live_quiz_rounds', v_round_id, null);
end;
$$;

grant execute on function presenter_void_live_quiz_question(uuid) to authenticated;

-- Reinicia a rodada atual do zero, descartando respostas já registradas.
create function presenter_restart_live_quiz_round(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_number int;
  v_round_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_question_number into v_round_number from live_quiz_sessions where id = p_session_id;
  select id into v_round_id from live_quiz_rounds where session_id = p_session_id and round_number = v_round_number and not voided;
  if v_round_id is null then
    raise exception 'Nenhuma rodada ativa para reiniciar';
  end if;
  if (select revealed_at from live_quiz_rounds where id = v_round_id) is not null then
    raise exception 'Não é possível reiniciar uma rodada já revelada — anule e avance para a próxima';
  end if;

  delete from live_quiz_answer_flags where round_id = v_round_id;
  delete from live_quiz_answers where round_id = v_round_id;
  update live_quiz_rounds
  set phase = 'ready', timer_started_at = null, timer_paused_at = null, timer_accumulated_ms = 0, revealed_at = null
  where id = v_round_id;
  update live_quiz_sessions set phase = 'ready' where id = p_session_id;

  perform log_audit('restart_round', 'live_quiz_rounds', v_round_id, null);
end;
$$;

grant execute on function presenter_restart_live_quiz_round(uuid) to authenticated;

create function presenter_next_live_quiz_question(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_next int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_session from live_quiz_sessions where id = p_session_id;
  v_next := v_session.current_question_number + 1;

  if v_next > v_session.questions_total then
    update live_quiz_sessions set phase = 'quiz_finished' where id = p_session_id;
    return json_build_object('quizComplete', true);
  end if;

  update live_quiz_sessions set current_question_number = v_next, phase = 'ready' where id = p_session_id;
  return json_build_object('quizComplete', false, 'questionNumber', v_next);
end;
$$;

grant execute on function presenter_next_live_quiz_question(uuid) to authenticated;

-- Cria uma rodada extra de desempate, só para os participantes empatados no
-- corte de classificação. Usa uma pergunta do tipo "tiebreaker" (não sorteada
-- nas rodadas normais). Reaproveita toda a máquina de estados genérica
-- (start_timer/end_question_early/reveal) porque a rodada de desempate
-- também vira "a rodada de current_question_number".
create function presenter_start_live_quiz_tiebreaker(p_session_id uuid, p_participant_ids uuid[])
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_question_id uuid;
  v_next int;
  v_round_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  if array_length(p_participant_ids, 1) is null or array_length(p_participant_ids, 1) < 2 then
    raise exception 'Selecione ao menos 2 participantes empatados';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;

  select q.id into v_question_id
  from question_set_items qsi
  join questions q on q.id = qsi.question_id
  where qsi.question_set_id = v_session.question_set_id
    and q.status = 'active'
    and q.type = 'tiebreaker'
    and q.id not in (select question_id from live_quiz_rounds where session_id = p_session_id and question_id is not null)
  order by random()
  limit 1;

  if v_question_id is null then
    raise exception 'Nenhuma pergunta de desempate disponível neste conjunto — cadastre uma pergunta do tipo "desempate"';
  end if;

  v_next := v_session.current_question_number + 1;

  insert into live_quiz_rounds (session_id, round_number, question_id, phase, timer_duration_seconds, is_tiebreaker, tiebreak_participant_ids)
  values (
    p_session_id,
    v_next,
    v_question_id,
    'tiebreaker_question',
    coalesce((select time_limit_seconds from questions where id = v_question_id), 20),
    true,
    p_participant_ids
  )
  returning id into v_round_id;

  update live_quiz_sessions set current_question_number = v_next, phase = 'tiebreaker_question' where id = p_session_id;
  perform log_audit('start_tiebreaker', 'live_quiz_rounds', v_round_id, to_jsonb(p_participant_ids));

  return json_build_object('roundId', v_round_id);
end;
$$;

grant execute on function presenter_start_live_quiz_tiebreaker(uuid, uuid[]) to authenticated;

-- Calcula a classificação final e separa os finalistas. Se houver empate
-- real na fronteira do corte (ex.: preciso de 2 e as posições 2 e 3 estão
-- empatadas em tudo, inclusive num desempate já jogado), devolve
-- needsTiebreak em vez de decidir por uma diferença mínima/arbitrária —
-- cabe ao apresentador rodar presenter_start_live_quiz_tiebreaker.
create function presenter_select_live_quiz_finalists(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_count int;
  v_cutoff_score int;
  v_cutoff_correct int;
  v_above_cutoff_ids uuid[];
  v_slots_remaining int;
  v_tied_ids uuid[];
  v_tiebreak_round_id uuid;
  v_ordered_tied_ids uuid[];
  v_finalist_ids uuid[];
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_session from live_quiz_sessions where id = p_session_id;
  v_count := v_session.finalists_count;

  if (select count(*) from v_live_quiz_ranking where session_id = p_session_id) < v_count then
    raise exception 'Participantes insuficientes para selecionar % finalistas', v_count;
  end if;

  select total_score, correct_count into v_cutoff_score, v_cutoff_correct
  from v_live_quiz_ranking where session_id = p_session_id and rank = v_count;

  -- Quem está estritamente acima da fronteira do corte já garantiu vaga;
  -- só quem empata com o último colocado dentro do corte concorre pela(s)
  -- vaga(s) restante(s).
  select coalesce(array_agg(participant_id), '{}') into v_above_cutoff_ids
  from v_live_quiz_ranking
  where session_id = p_session_id
    and (total_score > v_cutoff_score or (total_score = v_cutoff_score and correct_count > v_cutoff_correct));

  v_slots_remaining := v_count - coalesce(array_length(v_above_cutoff_ids, 1), 0);

  select array_agg(participant_id) into v_tied_ids
  from v_live_quiz_ranking
  where session_id = p_session_id and total_score = v_cutoff_score and correct_count = v_cutoff_correct;

  if array_length(v_tied_ids, 1) <= v_slots_remaining then
    -- Sem empate real na fronteira: todos os empatados cabem nas vagas.
    v_finalist_ids := v_above_cutoff_ids || v_tied_ids;
  else
    -- Empate real na última vaga — só decide se já houver uma rodada de
    -- desempate revelada cobrindo exatamente este grupo empatado.
    select id into v_tiebreak_round_id
    from live_quiz_rounds
    where session_id = p_session_id and is_tiebreaker and revealed_at is not null
      and v_tied_ids <@ tiebreak_participant_ids
    order by created_at desc
    limit 1;

    if v_tiebreak_round_id is null then
      return json_build_object('needsTiebreak', true, 'tiedParticipantIds', to_jsonb(v_tied_ids), 'slotsRemaining', v_slots_remaining);
    end if;

    select array_agg(participant_id order by is_correct desc, coalesce(response_time_ms, 2147483647) asc)
    into v_ordered_tied_ids
    from live_quiz_answers
    where round_id = v_tiebreak_round_id and participant_id = any(v_tied_ids);

    v_finalist_ids := v_above_cutoff_ids || v_ordered_tied_ids[1 : v_slots_remaining];
  end if;

  update live_quiz_participants set is_finalist = false, is_spectator = false where session_id = p_session_id;
  update live_quiz_participants set is_finalist = true where session_id = p_session_id and id = any(v_finalist_ids);
  update live_quiz_participants set is_spectator = true where session_id = p_session_id and not (id = any(v_finalist_ids));

  update live_quiz_sessions set phase = 'finalists_reveal' where id = p_session_id;
  perform log_audit('select_finalists', 'live_quiz_sessions', p_session_id, to_jsonb(v_finalist_ids));

  return json_build_object('needsTiebreak', false, 'finalistIds', to_jsonb(v_finalist_ids));
end;
$$;

grant execute on function presenter_select_live_quiz_finalists(uuid) to authenticated;

-- Contingência: o apresentador pode trocar manualmente um finalista antes
-- do duelo começar (ex.: alguém precisou sair).
create function presenter_replace_live_quiz_finalist(p_session_id uuid, p_out_participant_id uuid, p_in_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem substituir um finalista';
  end if;
  update live_quiz_participants set is_finalist = false, is_spectator = true
  where id = p_out_participant_id and session_id = p_session_id;
  update live_quiz_participants set is_finalist = true, is_spectator = false
  where id = p_in_participant_id and session_id = p_session_id;

  perform log_audit('replace_finalist', 'live_quiz_sessions', p_session_id, jsonb_build_object('out', p_out_participant_id, 'in', p_in_participant_id));
end;
$$;

grant execute on function presenter_replace_live_quiz_finalist(uuid, uuid, uuid) to authenticated;

-- Cria o duelo final com os 2 finalistas já dentro, sem exigir que
-- reentrem: os duel_players são criados diretamente (com seu próprio
-- join_token novo) e vinculados via live_quiz_participants.promoted_duel_player_id,
-- para que o próprio celular localize a nova identidade
-- (get_my_live_quiz_promotion) e troque de tela sozinho.
create function presenter_start_duel_from_live_quiz(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_match_id uuid;
  v_finalist record;
  v_color text;
  v_palette text[] := array['#5b21f0', '#06b6c4'];
  v_i int := 0;
  v_player_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_session from live_quiz_sessions where id = p_session_id for update;

  if v_session.promoted_duel_match_id is not null then
    -- Idempotente: se o comando for reenviado (ex.: duplo toque), devolve o
    -- duelo já criado em vez de criar um segundo.
    return json_build_object('matchId', v_session.promoted_duel_match_id);
  end if;

  if (select count(*) from live_quiz_participants where session_id = p_session_id and is_finalist) <> 2 then
    raise exception 'Selecione os 2 finalistas antes de iniciar o duelo';
  end if;

  insert into duel_matches (
    name, question_set_id, scoring_config_id, rounds_total, win_condition,
    presenter_id, status, phase, current_round_number, started_at
  )
  values (
    coalesce(v_session.name, 'Duelo final') || ' — Final',
    coalesce(v_session.duel_question_set_id, v_session.question_set_id),
    coalesce(v_session.duel_scoring_config_id, v_session.scoring_config_id),
    v_session.duel_rounds_total,
    v_session.duel_win_condition,
    coalesce(v_session.presenter_id, auth.uid()),
    'in_progress',
    'ready',
    1,
    now()
  )
  returning id into v_match_id;

  for v_finalist in
    select id, display_name from live_quiz_participants where session_id = p_session_id and is_finalist order by joined_at
  loop
    v_color := v_palette[1 + (v_i % array_length(v_palette, 1))];
    v_i := v_i + 1;

    insert into duel_players (match_id, display_name, avatar_color, is_active_disputant)
    values (v_match_id, v_finalist.display_name, v_color, true)
    returning id into v_player_id;

    insert into duel_player_secrets (player_id) values (v_player_id);

    update live_quiz_participants set promoted_duel_player_id = v_player_id where id = v_finalist.id;
  end loop;

  update live_quiz_sessions
  set promoted_duel_match_id = v_match_id, phase = 'duel_ready'
  where id = p_session_id;

  perform log_audit('start_duel_from_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('matchId', v_match_id));

  return json_build_object('matchId', v_match_id);
end;
$$;

grant execute on function presenter_start_duel_from_live_quiz(uuid) to authenticated;

create function presenter_set_live_quiz_manual_score(p_round_id uuid, p_participant_id uuid, p_points int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_points int;
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem corrigir pontuação manualmente';
  end if;

  select points_awarded into v_old_points from live_quiz_answers where round_id = p_round_id and participant_id = p_participant_id;
  if not found then
    raise exception 'Registro de resposta não encontrado para correção';
  end if;

  update live_quiz_answers set points_awarded = p_points where round_id = p_round_id and participant_id = p_participant_id;
  update live_quiz_participants set total_score = total_score + (p_points - v_old_points) where id = p_participant_id;

  perform log_audit('manual_score_correction', 'live_quiz_answers', p_round_id, jsonb_build_object('participantId', p_participant_id, 'oldPoints', v_old_points, 'newPoints', p_points));
end;
$$;

grant execute on function presenter_set_live_quiz_manual_score(uuid, uuid, int) to authenticated;

create function presenter_disconnect_live_quiz_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_participants set connected = false, left_at = now() where id = p_participant_id;
  perform log_audit('disconnect_participant', 'live_quiz_participants', p_participant_id, null);
end;
$$;

grant execute on function presenter_disconnect_live_quiz_participant(uuid) to authenticated;

create function presenter_set_live_quiz_participant_connected(p_participant_id uuid, p_connected boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_participants
  set connected = p_connected, left_at = case when p_connected then null else now() end
  where id = p_participant_id;
end;
$$;

grant execute on function presenter_set_live_quiz_participant_connected(uuid, boolean) to authenticated;

create function presenter_send_live_quiz_screen_message(p_session_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_sessions set screen_message = p_message where id = p_session_id;
end;
$$;

grant execute on function presenter_send_live_quiz_screen_message(uuid, text) to authenticated;

create function presenter_set_live_quiz_paused(p_session_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_sessions set paused = p_paused where id = p_session_id;
  perform log_audit(case when p_paused then 'pause' else 'resume' end, 'live_quiz_sessions', p_session_id, null);
end;
$$;

grant execute on function presenter_set_live_quiz_paused(uuid, boolean) to authenticated;

create function presenter_cancel_live_quiz(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem cancelar o quiz';
  end if;
  update live_quiz_sessions set status = 'cancelled', finished_at = now() where id = p_session_id;
  perform log_audit('cancel_live_quiz', 'live_quiz_sessions', p_session_id, null);
end;
$$;

grant execute on function presenter_cancel_live_quiz(uuid) to authenticated;

-- Fecha o registro da sessão coletiva depois que o duelo final acabou —
-- não interrompe nada, só marca o evento como concluído para relatórios.
create function presenter_finish_live_quiz(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update live_quiz_sessions set status = 'finished', finished_at = now() where id = p_session_id;
  perform log_audit('finish_live_quiz', 'live_quiz_sessions', p_session_id, null);
end;
$$;

grant execute on function presenter_finish_live_quiz(uuid) to authenticated;
