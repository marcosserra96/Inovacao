-- RPCs do Modo 2 (Duelo ao vivo). O apresentador (autenticado, admin_profiles)
-- controla toda a máquina de estados; participantes só chamam join/submit.

create function assign_join_code_trigger()
returns trigger
language plpgsql
as $$
declare
  v_code text;
  v_exists boolean;
  v_table text := tg_table_name;
begin
  if new.code is not null then
    return new;
  end if;
  loop
    v_code := generate_join_code();
    execute format('select exists(select 1 from %I where code = $1)', v_table) into v_exists using v_code;
    exit when not v_exists;
  end loop;
  new.code := v_code;
  return new;
end;
$$;

create trigger duel_matches_assign_code
  before insert on duel_matches
  for each row execute function assign_join_code_trigger();

create trigger individual_sessions_assign_code
  before insert on individual_sessions
  for each row execute function assign_join_code_trigger();

-- Conteúdo público e seguro da pergunta de uma rodada: nunca expõe qual
-- alternativa é correta antes de duel_rounds.revealed_at estar preenchido.
create function get_public_duel_round_question(p_round_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_round duel_rounds%rowtype;
begin
  select * into v_round from duel_rounds where id = p_round_id;
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

grant execute on function get_public_duel_round_question(uuid) to anon, authenticated;

-- Resultado consolidado de uma rodada já revelada (placar da rodada,
-- quem acertou, pontos). Retorna nulo se ainda não revelada.
create function get_duel_round_result(p_round_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when dr.revealed_at is null then null else
    json_build_object(
      'roundId', dr.id,
      'revealedAt', dr.revealed_at,
      'winnerPlayerId', dr.winner_player_id,
      'answers', (
        select json_agg(json_build_object(
          'playerId', da.player_id,
          'optionId', da.option_id,
          'isCorrect', da.is_correct,
          'isLate', da.is_late,
          'pointsAwarded', da.points_awarded,
          'responseTimeMs', da.response_time_ms
        ))
        from duel_answers da where da.round_id = dr.id
      )
    )
  end
  from duel_rounds dr where dr.id = p_round_id;
$$;

grant execute on function get_duel_round_result(uuid) to anon, authenticated;

create function create_duel_match(
  p_name text,
  p_question_set_id uuid,
  p_scoring_config_id uuid,
  p_rounds_total int default 5
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Apenas administradores ou apresentadores podem criar partidas';
  end if;

  insert into duel_matches (name, question_set_id, scoring_config_id, rounds_total, presenter_id, status, phase)
  values (p_name, p_question_set_id, p_scoring_config_id, p_rounds_total, auth.uid(), 'lobby', 'waiting_players')
  returning id into v_match_id;

  perform log_audit('create_match', 'duel_matches', v_match_id, null);

  return (select json_build_object('matchId', id, 'code', code) from duel_matches where id = v_match_id);
end;
$$;

grant execute on function create_duel_match(text, uuid, uuid, int) to authenticated;

create function join_duel_match(p_code text, p_display_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_player_id uuid;
  v_color text;
  v_palette text[] := array['#5b21f0', '#06b6c4', '#f5a623', '#16c784', '#f0405b'];
begin
  select * into v_match from duel_matches where upper(code) = upper(p_code);
  if not found then
    raise exception 'Código de partida inválido';
  end if;
  if v_match.locked then
    raise exception 'Esta partida não está aceitando novos participantes';
  end if;
  if v_match.status in ('finished', 'cancelled') then
    raise exception 'Esta partida já foi encerrada';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Informe seu nome para entrar';
  end if;

  v_color := v_palette[1 + (select count(*) from duel_players where match_id = v_match.id) % array_length(v_palette, 1)];

  insert into duel_players (match_id, display_name, avatar_color)
  values (v_match.id, trim(p_display_name), v_color)
  returning id into v_player_id;

  if v_match.phase = 'waiting_players' then
    update duel_matches set phase = 'players_connected' where id = v_match.id;
  end if;

  return json_build_object('matchId', v_match.id, 'playerId', v_player_id, 'code', v_match.code);
end;
$$;

grant execute on function join_duel_match(text, text) to anon, authenticated;

create function presenter_select_disputants(p_match_id uuid, p_player_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Apenas administradores ou apresentadores podem selecionar disputantes';
  end if;
  if array_length(p_player_ids, 1) <> 2 then
    raise exception 'Selecione exatamente 2 participantes para o duelo';
  end if;

  update duel_players set is_active_disputant = false where match_id = p_match_id;
  update duel_players set is_active_disputant = true where match_id = p_match_id and id = any(p_player_ids);
  update duel_matches set phase = 'ready' where id = p_match_id;

  perform log_audit('select_disputants', 'duel_matches', p_match_id, to_jsonb(p_player_ids));
end;
$$;

grant execute on function presenter_select_disputants(uuid, uuid[]) to authenticated;

create function presenter_start_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  if (select count(*) from duel_players where match_id = p_match_id and is_active_disputant) <> 2 then
    raise exception 'Selecione os 2 disputantes antes de iniciar';
  end if;

  update duel_matches
  set status = 'in_progress', phase = 'ready', current_round_number = 1, started_at = now()
  where id = p_match_id;

  perform log_audit('start_match', 'duel_matches', p_match_id, null);
end;
$$;

grant execute on function presenter_start_match(uuid) to authenticated;

-- Libera a próxima pergunta no telão/celulares (cria o registro da rodada
-- se ainda não existir) sem iniciar o cronômetro.
create function presenter_show_question(p_match_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_round_id uuid;
  v_question_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_match from duel_matches where id = p_match_id for update;

  select id into v_round_id from duel_rounds
  where match_id = p_match_id and round_number = v_match.current_round_number and not voided;

  if v_round_id is null then
    select q.id into v_question_id
    from question_set_items qsi
    join questions q on q.id = qsi.question_id
    where qsi.question_set_id = v_match.question_set_id
      and q.status = 'active'
      and 'duel' = any(q.modes)
      and q.id not in (
        select question_id from duel_rounds where match_id = p_match_id and question_id is not null
      )
    order by random()
    limit 1;

    if v_question_id is null then
      raise exception 'Não há mais perguntas disponíveis neste conjunto para o duelo';
    end if;

    insert into duel_rounds (match_id, round_number, question_id, phase, timer_duration_seconds)
    values (
      p_match_id,
      v_match.current_round_number,
      v_question_id,
      'question_shown',
      coalesce((select time_limit_seconds from questions where id = v_question_id), 20)
    )
    returning id into v_round_id;
  else
    update duel_rounds set phase = 'question_shown' where id = v_round_id;
  end if;

  update duel_matches set phase = 'question_shown' where id = p_match_id;
  perform log_audit('show_question', 'duel_rounds', v_round_id, null);

  return json_build_object('roundId', v_round_id);
end;
$$;

grant execute on function presenter_show_question(uuid) to authenticated;

create function presenter_start_timer(p_match_id uuid)
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
  select current_round_number into v_round_number from duel_matches where id = p_match_id;
  select id into v_round_id from duel_rounds where match_id = p_match_id and round_number = v_round_number and not voided;

  update duel_rounds
  set timer_started_at = now(), timer_paused_at = null, timer_accumulated_ms = 0, phase = 'awaiting_answers'
  where id = v_round_id;

  update duel_matches set phase = 'awaiting_answers' where id = p_match_id;
end;
$$;

grant execute on function presenter_start_timer(uuid) to authenticated;

create function presenter_pause_timer(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round duel_rounds%rowtype;
  v_round_number int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_round_number into v_round_number from duel_matches where id = p_match_id;
  select * into v_round from duel_rounds where match_id = p_match_id and round_number = v_round_number and not voided;

  if v_round.timer_started_at is not null and v_round.timer_paused_at is null then
    update duel_rounds
    set timer_accumulated_ms = timer_accumulated_ms + extract(epoch from (now() - timer_started_at)) * 1000,
        timer_paused_at = now()
    where id = v_round.id;
  end if;
end;
$$;

grant execute on function presenter_pause_timer(uuid) to authenticated;

create function presenter_resume_timer(p_match_id uuid)
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
  select current_round_number into v_round_number from duel_matches where id = p_match_id;

  update duel_rounds
  set timer_started_at = now(), timer_paused_at = null
  where match_id = p_match_id and round_number = v_round_number and not voided and timer_paused_at is not null;
end;
$$;

grant execute on function presenter_resume_timer(uuid) to authenticated;

-- Encerra a janela de respostas antecipadamente (sem esperar o cronômetro).
create function presenter_end_question_early(p_match_id uuid)
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
  select current_round_number into v_round_number from duel_matches where id = p_match_id;

  update duel_rounds set phase = 'time_up' where match_id = p_match_id and round_number = v_round_number and not voided;
  update duel_matches set phase = 'time_up' where id = p_match_id;
end;
$$;

grant execute on function presenter_end_question_early(uuid) to authenticated;

create function submit_duel_answer(p_round_id uuid, p_player_id uuid, p_option_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round duel_rounds%rowtype;
  v_match duel_matches%rowtype;
  v_scoring scoring_configs%rowtype;
  v_question questions%rowtype;
  v_elapsed_ms bigint;
  v_total_ms bigint;
  v_is_correct boolean;
  v_is_late boolean;
  v_points int;
  v_both_answered boolean;
begin
  select * into v_round from duel_rounds where id = p_round_id for update;
  if not found then
    raise exception 'Rodada não encontrada';
  end if;
  if v_round.phase <> 'awaiting_answers' then
    raise exception 'Esta rodada não está aceitando respostas no momento';
  end if;
  if exists (select 1 from duel_answers where round_id = p_round_id and player_id = p_player_id) then
    raise exception 'Você já respondeu esta rodada';
  end if;
  if not exists (select 1 from duel_players where id = p_player_id and match_id = v_round.match_id and is_active_disputant) then
    raise exception 'Jogador não faz parte desta partida';
  end if;

  select * into v_match from duel_matches where id = v_round.match_id;
  select * into v_scoring from scoring_configs where id = v_match.scoring_config_id;
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
    case when v_match.enable_speed_bonus then v_scoring.speed_bonus_max else 0 end,
    least(v_elapsed_ms, v_total_ms),
    v_total_ms,
    false, 0, 0, 0,
    v_match.enable_penalty,
    v_match.penalty_wrong
  );

  insert into duel_answers (round_id, player_id, option_id, is_correct, is_late, response_time_ms, points_awarded)
  values (p_round_id, p_player_id, case when v_is_late then null else p_option_id end, v_is_correct, v_is_late, least(v_elapsed_ms, v_total_ms)::int, v_points);

  if v_match.end_on_both_answered then
    select count(*) = 2 into v_both_answered
    from duel_answers
    where round_id = p_round_id and player_id in (
      select id from duel_players where match_id = v_round.match_id and is_active_disputant
    );
    if v_both_answered then
      update duel_rounds set phase = 'answers_received' where id = p_round_id;
      update duel_matches set phase = 'answers_received' where id = v_round.match_id;
    end if;
  end if;

  return json_build_object('recorded', true);
end;
$$;

grant execute on function submit_duel_answer(uuid, uuid, uuid) to anon, authenticated;

-- Revela a resposta correta e aplica a pontuação da rodada aos jogadores.
-- Jogadores que não responderam recebem um registro de "sem resposta" para
-- que o resultado da rodada fique completo e auditável.
create function presenter_reveal_answer(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round duel_rounds%rowtype;
  v_round_number int;
  v_player record;
  v_correct_option_id uuid;
  v_best_points int := -2147483648;
  v_winner uuid := null;
  v_tie boolean := false;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select current_round_number into v_round_number from duel_matches where id = p_match_id;
  select * into v_round from duel_rounds where match_id = p_match_id and round_number = v_round_number and not voided for update;
  if v_round.revealed_at is not null then
    raise exception 'Esta rodada já foi revelada';
  end if;

  select id into v_correct_option_id from question_options where question_id = v_round.question_id and is_correct limit 1;

  for v_player in
    select id from duel_players where match_id = p_match_id and is_active_disputant
  loop
    if not exists (select 1 from duel_answers where round_id = v_round.id and player_id = v_player.id) then
      insert into duel_answers (round_id, player_id, option_id, is_correct, is_late, response_time_ms, points_awarded)
      values (v_round.id, v_player.id, null, false, true, v_round.timer_duration_seconds * 1000, 0);
    end if;
  end loop;

  for v_player in
    select player_id, points_awarded from duel_answers where round_id = v_round.id
  loop
    if v_player.points_awarded > v_best_points then
      v_best_points := v_player.points_awarded;
      v_winner := v_player.player_id;
      v_tie := false;
    elsif v_player.points_awarded = v_best_points then
      v_tie := true;
    end if;
  end loop;

  update duel_rounds
  set revealed_at = now(), phase = 'result_revealed', winner_player_id = case when v_tie then null else v_winner end
  where id = v_round.id;

  update duel_matches set phase = 'result_revealed' where id = p_match_id;

  update duel_players dp
  set total_score = dp.total_score + da.points_awarded,
      correct_count = dp.correct_count + (case when da.is_correct then 1 else 0 end)
  from duel_answers da
  where da.round_id = v_round.id and da.player_id = dp.id;

  perform log_audit('reveal_answer', 'duel_rounds', v_round.id, null);
end;
$$;

grant execute on function presenter_reveal_answer(uuid) to authenticated;

-- Anula a rodada atual (não conta para o placar); o apresentador segue
-- para a próxima rodada em seguida.
create function presenter_void_question(p_match_id uuid)
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
  select current_round_number into v_round_number from duel_matches where id = p_match_id;
  select id into v_round_id from duel_rounds where match_id = p_match_id and round_number = v_round_number and not voided;
  if v_round_id is null then
    raise exception 'Nenhuma rodada ativa para anular';
  end if;

  update duel_rounds set voided = true, phase = 'ready' where id = v_round_id;
  update duel_matches set phase = 'ready' where id = p_match_id;

  perform log_audit('void_question', 'duel_rounds', v_round_id, null);
end;
$$;

grant execute on function presenter_void_question(uuid) to authenticated;

-- Reinicia a rodada atual do zero (mesma pergunta ou nova, a critério do
-- próximo presenter_show_question), descartando respostas já registradas.
create function presenter_restart_round(p_match_id uuid)
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
  select current_round_number into v_round_number from duel_matches where id = p_match_id;
  select id into v_round_id from duel_rounds where match_id = p_match_id and round_number = v_round_number and not voided;
  if v_round_id is null then
    raise exception 'Nenhuma rodada ativa para reiniciar';
  end if;
  if (select revealed_at from duel_rounds where id = v_round_id) is not null then
    raise exception 'Não é possível reiniciar uma rodada já revelada — anule e avance para a próxima';
  end if;

  delete from duel_answer_flags where round_id = v_round_id;
  delete from duel_answers where round_id = v_round_id;
  update duel_rounds
  set phase = 'ready', timer_started_at = null, timer_paused_at = null, timer_accumulated_ms = 0, revealed_at = null, winner_player_id = null
  where id = v_round_id;
  update duel_matches set phase = 'ready' where id = p_match_id;

  perform log_audit('restart_round', 'duel_rounds', v_round_id, null);
end;
$$;

grant execute on function presenter_restart_round(uuid) to authenticated;

create function presenter_next_round(p_match_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_next int;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_match from duel_matches where id = p_match_id;
  v_next := v_match.current_round_number + 1;

  if v_next > v_match.rounds_total then
    return json_build_object('matchComplete', true);
  end if;

  update duel_matches set current_round_number = v_next, phase = 'ready' where id = p_match_id;
  return json_build_object('matchComplete', false, 'roundNumber', v_next);
end;
$$;

grant execute on function presenter_next_round(uuid) to authenticated;

create function presenter_end_match(p_match_id uuid, p_winner_player_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_winner uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_match from duel_matches where id = p_match_id;

  if p_winner_player_id is not null then
    v_winner := p_winner_player_id;
  else
    select id into v_winner
    from duel_players
    where match_id = p_match_id and is_active_disputant
    order by (case when v_match.win_condition = 'score' then total_score else correct_count end) desc,
             total_score desc, correct_count desc
    limit 1;

    if (
      select count(distinct (case when v_match.win_condition = 'score' then total_score else correct_count end))
      from duel_players where match_id = p_match_id and is_active_disputant
    ) = 1 then
      v_winner := null; -- empate total
    end if;
  end if;

  update duel_matches
  set status = 'finished', phase = 'match_ended', ended_at = now(), winner_player_id = v_winner
  where id = p_match_id;

  perform log_audit('end_match', 'duel_matches', p_match_id, jsonb_build_object('winnerPlayerId', v_winner, 'manual', p_winner_player_id is not null));
end;
$$;

grant execute on function presenter_end_match(uuid, uuid) to authenticated;

create function presenter_set_manual_score(p_round_id uuid, p_player_id uuid, p_points int)
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

  select points_awarded into v_old_points from duel_answers where round_id = p_round_id and player_id = p_player_id;
  if not found then
    raise exception 'Registro de resposta não encontrado para correção';
  end if;

  update duel_answers set points_awarded = p_points where round_id = p_round_id and player_id = p_player_id;
  update duel_players set total_score = total_score + (p_points - v_old_points) where id = p_player_id;

  perform log_audit('manual_score_correction', 'duel_answers', p_round_id, jsonb_build_object('playerId', p_player_id, 'oldPoints', v_old_points, 'newPoints', p_points));
end;
$$;

grant execute on function presenter_set_manual_score(uuid, uuid, int) to authenticated;

create function presenter_disconnect_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update duel_players set connected = false, left_at = now() where id = p_player_id;
  perform log_audit('disconnect_player', 'duel_players', p_player_id, null);
end;
$$;

grant execute on function presenter_disconnect_player(uuid) to authenticated;

create function presenter_set_player_connected(p_player_id uuid, p_connected boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update duel_players
  set connected = p_connected, left_at = case when p_connected then null else now() end
  where id = p_player_id;
end;
$$;

grant execute on function presenter_set_player_connected(uuid, boolean) to anon, authenticated;

create function presenter_lock_match(p_match_id uuid, p_locked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update duel_matches set locked = p_locked where id = p_match_id;
  perform log_audit('lock_match', 'duel_matches', p_match_id, jsonb_build_object('locked', p_locked));
end;
$$;

grant execute on function presenter_lock_match(uuid, boolean) to authenticated;

create function presenter_send_screen_message(p_match_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update duel_matches set screen_message = p_message where id = p_match_id;
end;
$$;

grant execute on function presenter_send_screen_message(uuid, text) to authenticated;
