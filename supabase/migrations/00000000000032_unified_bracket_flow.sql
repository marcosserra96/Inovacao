-- Consolida o fluxo novo da Rota de Inovação:
-- Quiz coletivo -> Top 4 -> semifinais sincronizadas -> final -> campeão.
-- O apresentador só inicia manualmente cada etapa; as rodadas avançam sozinhas.

create or replace function is_current_live_dynamic(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from game_control
    where id = true
      and active_live_quiz_session_id = p_session_id
      and active_mode = 'live_quiz'
  );
$$;

revoke all on function is_current_live_dynamic(uuid) from public;

create or replace function system_select_live_quiz_top4(p_session_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(participant_id order by rank, participant_id), '{}'::uuid[])
  into v_ids
  from (
    select participant_id, rank
    from v_live_quiz_ranking
    where session_id = p_session_id
    order by rank, participant_id
    limit 4
  ) ranked;

  update live_quiz_participants
  set is_finalist = (id = any(v_ids)),
      is_spectator = not (id = any(v_ids))
  where session_id = p_session_id;

  return v_ids;
end;
$$;

revoke all on function system_select_live_quiz_top4(uuid) from public;

-- Revelação idempotente de uma partida de duelo, usada pelo motor automático.
create or replace function system_reveal_duel_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_round duel_rounds%rowtype;
  v_player record;
  v_best_points int := -2147483648;
  v_winner uuid := null;
  v_tie boolean := false;
begin
  select * into v_match from duel_matches where id = p_match_id for update;
  if not found then return; end if;

  select * into v_round
  from duel_rounds
  where match_id = p_match_id
    and round_number = v_match.current_round_number
    and not voided
  order by created_at desc
  limit 1
  for update;

  if not found or v_round.revealed_at is not null then return; end if;

  for v_player in
    select id from duel_players where match_id = p_match_id and is_active_disputant
  loop
    if not exists (
      select 1 from duel_answers where round_id = v_round.id and player_id = v_player.id
    ) then
      insert into duel_answers (
        round_id, player_id, option_id, is_correct, is_late, response_time_ms, points_awarded
      ) values (
        v_round.id, v_player.id, null, false, true,
        greatest(0, coalesce(v_round.timer_duration_seconds, 20)) * 1000,
        0
      );
    end if;
  end loop;

  for v_player in
    select player_id, points_awarded
    from duel_answers
    where round_id = v_round.id
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
  set revealed_at = now(),
      phase = 'result_revealed',
      winner_player_id = case when v_tie then null else v_winner end
  where id = v_round.id;

  update duel_matches
  set phase = 'result_revealed'
  where id = p_match_id;

  update duel_players dp
  set total_score = dp.total_score + da.points_awarded,
      correct_count = dp.correct_count + case when da.is_correct then 1 else 0 end
  from duel_answers da
  where da.round_id = v_round.id
    and da.player_id = dp.id;
end;
$$;

revoke all on function system_reveal_duel_match(uuid) from public;

-- Sempre produz um vencedor de forma estável. Em empate de placar/acertos,
-- usa tempo médio das respostas corretas e depois ordem de entrada.
create or replace function system_finish_duel_match(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_winner uuid;
begin
  select * into v_match from duel_matches where id = p_match_id for update;
  if not found then return null; end if;
  if v_match.status = 'finished' and v_match.winner_player_id is not null then
    return v_match.winner_player_id;
  end if;

  select dp.id
  into v_winner
  from duel_players dp
  where dp.match_id = p_match_id
    and dp.is_active_disputant
  order by
    case when v_match.win_condition = 'score' then dp.total_score else dp.correct_count end desc,
    dp.total_score desc,
    dp.correct_count desc,
    coalesce((
      select avg(da.response_time_ms)
      from duel_answers da
      join duel_rounds dr on dr.id = da.round_id
      where da.player_id = dp.id and da.is_correct and not dr.voided
    ), 2147483647) asc,
    dp.joined_at asc,
    dp.id asc
  limit 1;

  update duel_matches
  set status = 'finished',
      phase = 'match_ended',
      ended_at = coalesce(ended_at, now()),
      winner_player_id = v_winner
  where id = p_match_id;

  return v_winner;
end;
$$;

revoke all on function system_finish_duel_match(uuid) from public;

create or replace function system_ensure_semifinal_round(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_match1 duel_matches%rowtype;
  v_match2 duel_matches%rowtype;
  v_round1 uuid;
  v_round2 uuid;
  v_question uuid;
  v_seconds int;
begin
  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  select * into v_match1 from duel_matches where id = v_session.semifinal1_match_id for update;
  select * into v_match2 from duel_matches where id = v_session.semifinal2_match_id for update;

  if v_match1.id is null or v_match2.id is null then
    raise exception 'Semifinais não preparadas';
  end if;
  if v_match1.current_round_number <> v_match2.current_round_number then
    raise exception 'Semifinais fora de sincronia';
  end if;

  select id, question_id into v_round1, v_question
  from duel_rounds
  where match_id = v_match1.id
    and round_number = v_match1.current_round_number
    and not voided
  order by created_at desc
  limit 1;

  if v_round1 is null then
    select q.id into v_question
    from question_set_items qsi
    join questions q on q.id = qsi.question_id
    where qsi.question_set_id = v_match1.question_set_id
      and q.status = 'active'
      and 'duel' = any(q.modes)
      and q.id not in (
        select dr.question_id
        from duel_rounds dr
        where dr.match_id in (v_match1.id, v_match2.id)
          and dr.question_id is not null
      )
    order by random()
    limit 1;

    if v_question is null then
      raise exception 'Não há mais perguntas disponíveis para as semifinais';
    end if;

    v_seconds := greatest(5, coalesce(v_session.question_time_seconds, 20));

    insert into duel_rounds (
      match_id, round_number, question_id, phase,
      timer_duration_seconds, timer_started_at, timer_paused_at, timer_accumulated_ms
    ) values (
      v_match1.id, v_match1.current_round_number, v_question, 'awaiting_answers',
      v_seconds, now(), null, 0
    ) returning id into v_round1;
  else
    v_seconds := greatest(5, coalesce((select timer_duration_seconds from duel_rounds where id = v_round1), v_session.question_time_seconds, 20));
    update duel_rounds
    set phase = 'awaiting_answers', timer_started_at = now(), timer_paused_at = null
    where id = v_round1;
  end if;

  select id into v_round2
  from duel_rounds
  where match_id = v_match2.id
    and round_number = v_match2.current_round_number
    and not voided
  order by created_at desc
  limit 1;

  if v_round2 is null then
    insert into duel_rounds (
      match_id, round_number, question_id, phase,
      timer_duration_seconds, timer_started_at, timer_paused_at, timer_accumulated_ms
    ) values (
      v_match2.id, v_match2.current_round_number, v_question, 'awaiting_answers',
      v_seconds, now(), null, 0
    ) returning id into v_round2;
  else
    update duel_rounds
    set question_id = v_question,
        phase = 'awaiting_answers',
        timer_duration_seconds = v_seconds,
        timer_started_at = now(),
        timer_paused_at = null
    where id = v_round2;
  end if;

  update duel_matches
  set phase = 'awaiting_answers'
  where id in (v_match1.id, v_match2.id);

  return json_build_object('round1Id', v_round1, 'round2Id', v_round2, 'seconds', v_seconds);
end;
$$;

revoke all on function system_ensure_semifinal_round(uuid) from public;

create or replace function system_ensure_final_round(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_match duel_matches%rowtype;
  v_round uuid;
  v_question uuid;
  v_seconds int;
begin
  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  select * into v_match from duel_matches where id = v_session.promoted_duel_match_id for update;

  if v_match.id is null then raise exception 'Final não preparada'; end if;

  select id, question_id into v_round, v_question
  from duel_rounds
  where match_id = v_match.id
    and round_number = v_match.current_round_number
    and not voided
  order by created_at desc
  limit 1;

  if v_round is null then
    select q.id into v_question
    from question_set_items qsi
    join questions q on q.id = qsi.question_id
    where qsi.question_set_id = v_match.question_set_id
      and q.status = 'active'
      and 'duel' = any(q.modes)
      and q.id not in (
        select dr.question_id
        from duel_rounds dr
        where dr.match_id = v_match.id and dr.question_id is not null
      )
    order by random()
    limit 1;

    if v_question is null then
      raise exception 'Não há mais perguntas disponíveis para a final';
    end if;

    v_seconds := greatest(5, coalesce(v_session.question_time_seconds, 20));

    insert into duel_rounds (
      match_id, round_number, question_id, phase,
      timer_duration_seconds, timer_started_at, timer_paused_at, timer_accumulated_ms
    ) values (
      v_match.id, v_match.current_round_number, v_question, 'awaiting_answers',
      v_seconds, now(), null, 0
    ) returning id into v_round;
  else
    v_seconds := greatest(5, coalesce((select timer_duration_seconds from duel_rounds where id = v_round), v_session.question_time_seconds, 20));
    update duel_rounds
    set phase = 'awaiting_answers', timer_started_at = now(), timer_paused_at = null
    where id = v_round;
  end if;

  update duel_matches set phase = 'awaiting_answers' where id = v_match.id;

  return json_build_object('roundId', v_round, 'seconds', v_seconds);
end;
$$;

revoke all on function system_ensure_final_round(uuid) from public;

create or replace function presenter_start_current_semifinals(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_ids uuid[];
  v_semi1 uuid;
  v_semi2 uuid;
begin
  if not is_current_live_dynamic(p_session_id) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;

  if v_session.flow_state not in ('quiz_result', 'semifinal_ready', 'semifinal_result') then
    if v_session.flow_state like 'semifinal_%' then
      return json_build_object('started', true, 'semifinal1MatchId', v_session.semifinal1_match_id, 'semifinal2MatchId', v_session.semifinal2_match_id);
    end if;
    raise exception 'O quiz ainda não chegou ao fim';
  end if;

  v_ids := system_select_live_quiz_top4(p_session_id);
  if coalesce(array_length(v_ids, 1), 0) < 4 then
    raise exception 'São necessários pelo menos 4 participantes para iniciar as semifinais';
  end if;

  v_semi1 := v_session.semifinal1_match_id;
  v_semi2 := v_session.semifinal2_match_id;

  if v_semi1 is null or v_semi2 is null then
    -- Chaveamento fixo: 1º x 4º e 2º x 3º.
    v_semi1 := create_live_quiz_duel_match(
      p_session_id,
      coalesce(v_session.name, 'Dinâmica') || ' — Semifinal 1',
      array[v_ids[1], v_ids[4]],
      v_session.duel_question_set_id,
      v_session.duel_rounds_total
    );
    v_semi2 := create_live_quiz_duel_match(
      p_session_id,
      coalesce(v_session.name, 'Dinâmica') || ' — Semifinal 2',
      array[v_ids[2], v_ids[3]],
      v_session.duel_question_set_id,
      v_session.duel_rounds_total
    );

    update duel_matches set paired_match_id = v_semi2 where id = v_semi1;
    update duel_matches set paired_match_id = v_semi1 where id = v_semi2;
  end if;

  update live_quiz_sessions
  set semifinal1_match_id = v_semi1,
      semifinal2_match_id = v_semi2,
      phase = 'duel_semifinals',
      flow_state = 'semifinal_prepare',
      flow_deadline_at = now() + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      paused = false,
      participant_ranking_visible = false,
      updated_at = now()
  where id = p_session_id;

  update duel_matches
  set status = 'in_progress', phase = 'ready', current_round_number = 1
  where id in (v_semi1, v_semi2);

  return json_build_object(
    'started', true,
    'semifinal1MatchId', v_semi1,
    'semifinal2MatchId', v_semi2,
    'finalistIds', to_jsonb(v_ids)
  );
end;
$$;

grant execute on function presenter_start_current_semifinals(uuid) to anon, authenticated;

create or replace function presenter_start_current_final(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_semi1 duel_matches%rowtype;
  v_semi2 duel_matches%rowtype;
  v_winner1 uuid;
  v_winner2 uuid;
  v_final uuid;
begin
  if not is_current_live_dynamic(p_session_id) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;
  if v_session.flow_state <> 'semifinal_result' and v_session.flow_state not like 'final_%' and v_session.flow_state <> 'champion' then
    raise exception 'As semifinais ainda não terminaram';
  end if;

  if v_session.promoted_duel_match_id is not null then
    return json_build_object('started', true, 'matchId', v_session.promoted_duel_match_id);
  end if;

  select * into v_semi1 from duel_matches where id = v_session.semifinal1_match_id;
  select * into v_semi2 from duel_matches where id = v_session.semifinal2_match_id;

  if v_semi1.status <> 'finished' or v_semi2.status <> 'finished' or v_semi1.winner_player_id is null or v_semi2.winner_player_id is null then
    raise exception 'As duas semifinais precisam ter um vencedor';
  end if;

  select promoted_from_live_quiz_participant_id into v_winner1 from duel_players where id = v_semi1.winner_player_id;
  select promoted_from_live_quiz_participant_id into v_winner2 from duel_players where id = v_semi2.winner_player_id;

  v_final := create_live_quiz_duel_match(
    p_session_id,
    coalesce(v_session.name, 'Dinâmica') || ' — Final',
    array[v_winner1, v_winner2],
    v_session.final_question_set_id,
    coalesce(v_session.final_rounds_total, v_session.duel_rounds_total)
  );

  update live_quiz_sessions
  set promoted_duel_match_id = v_final,
      phase = 'duel_final',
      flow_state = 'final_prepare',
      flow_deadline_at = now() + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      paused = false,
      updated_at = now()
  where id = p_session_id;

  return json_build_object('started', true, 'matchId', v_final);
end;
$$;

grant execute on function presenter_start_current_final(uuid) to anon, authenticated;

create or replace function tick_current_dynamic_flow(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_match1 duel_matches%rowtype;
  v_match2 duel_matches%rowtype;
  v_final duel_matches%rowtype;
  v_round1 duel_rounds%rowtype;
  v_round2 duel_rounds%rowtype;
  v_roundf duel_rounds%rowtype;
  v_payload json;
  v_seconds int;
  v_all_answered boolean := false;
  v_now timestamptz := now();
begin
  if not is_current_live_dynamic(p_session_id) then
    return json_build_object('ignored', true);
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;

  if v_session.paused then
    return json_build_object('flowState', v_session.flow_state, 'paused', true);
  end if;

  if v_session.flow_state in ('prepare', 'question', 'reveal', 'ranking') then
    perform tick_live_quiz_flow(p_session_id);
    select * into v_session from live_quiz_sessions where id = p_session_id;
    if v_session.flow_state = 'quiz_result' then
      perform system_select_live_quiz_top4(p_session_id);
      update live_quiz_sessions set phase = 'finalists_reveal', updated_at = now() where id = p_session_id;
    end if;
    return json_build_object('flowState', v_session.flow_state, 'deadlineAt', v_session.flow_deadline_at);
  end if;

  if v_session.flow_state = 'quiz_result' then
    perform system_select_live_quiz_top4(p_session_id);
    return json_build_object('flowState', 'quiz_result', 'deadlineAt', null);
  end if;

  if v_session.flow_state = 'semifinal_question' then
    select * into v_match1 from duel_matches where id = v_session.semifinal1_match_id;
    select * into v_match2 from duel_matches where id = v_session.semifinal2_match_id;
    select * into v_round1 from duel_rounds where match_id = v_match1.id and round_number = v_match1.current_round_number and not voided order by created_at desc limit 1;
    select * into v_round2 from duel_rounds where match_id = v_match2.id and round_number = v_match2.current_round_number and not voided order by created_at desc limit 1;

    v_all_answered := v_round1.id is not null and v_round2.id is not null
      and (select count(*) from duel_answer_flags where round_id = v_round1.id and answered) >= 2
      and (select count(*) from duel_answer_flags where round_id = v_round2.id and answered) >= 2;
  elsif v_session.flow_state = 'final_question' then
    select * into v_final from duel_matches where id = v_session.promoted_duel_match_id;
    select * into v_roundf from duel_rounds where match_id = v_final.id and round_number = v_final.current_round_number and not voided order by created_at desc limit 1;
    v_all_answered := v_roundf.id is not null
      and (select count(*) from duel_answer_flags where round_id = v_roundf.id and answered) >= 2;
  end if;

  if not v_all_answered and (v_session.flow_deadline_at is null or v_session.flow_deadline_at > v_now) then
    return json_build_object('flowState', v_session.flow_state, 'deadlineAt', v_session.flow_deadline_at);
  end if;

  if v_session.flow_state = 'semifinal_prepare' then
    v_payload := system_ensure_semifinal_round(p_session_id);
    v_seconds := coalesce((v_payload ->> 'seconds')::int, greatest(5, coalesce(v_session.question_time_seconds, 20)));
    update live_quiz_sessions
    set flow_state = 'semifinal_question',
        flow_deadline_at = v_now + make_interval(secs => v_seconds),
        updated_at = v_now
    where id = p_session_id;

  elsif v_session.flow_state = 'semifinal_question' then
    perform system_reveal_duel_match(v_session.semifinal1_match_id);
    perform system_reveal_duel_match(v_session.semifinal2_match_id);
    update live_quiz_sessions
    set flow_state = 'semifinal_reveal',
        flow_deadline_at = v_now + make_interval(secs => greatest(1, coalesce(reveal_seconds, 3))),
        updated_at = v_now
    where id = p_session_id;

  elsif v_session.flow_state = 'semifinal_reveal' then
    select * into v_match1 from duel_matches where id = v_session.semifinal1_match_id for update;
    select * into v_match2 from duel_matches where id = v_session.semifinal2_match_id for update;

    if v_match1.current_round_number >= v_match1.rounds_total then
      perform system_finish_duel_match(v_match1.id);
      perform system_finish_duel_match(v_match2.id);
      update live_quiz_sessions
      set flow_state = 'semifinal_result',
          flow_deadline_at = null,
          updated_at = v_now
      where id = p_session_id;
    else
      update duel_matches
      set current_round_number = current_round_number + 1,
          phase = 'ready'
      where id in (v_match1.id, v_match2.id);

      update live_quiz_sessions
      set flow_state = 'semifinal_prepare',
          flow_deadline_at = v_now + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
          updated_at = v_now
      where id = p_session_id;
    end if;

  elsif v_session.flow_state = 'final_prepare' then
    v_payload := system_ensure_final_round(p_session_id);
    v_seconds := coalesce((v_payload ->> 'seconds')::int, greatest(5, coalesce(v_session.question_time_seconds, 20)));
    update live_quiz_sessions
    set flow_state = 'final_question',
        flow_deadline_at = v_now + make_interval(secs => v_seconds),
        updated_at = v_now
    where id = p_session_id;

  elsif v_session.flow_state = 'final_question' then
    perform system_reveal_duel_match(v_session.promoted_duel_match_id);
    update live_quiz_sessions
    set flow_state = 'final_reveal',
        flow_deadline_at = v_now + make_interval(secs => greatest(1, coalesce(reveal_seconds, 3))),
        updated_at = v_now
    where id = p_session_id;

  elsif v_session.flow_state = 'final_reveal' then
    select * into v_final from duel_matches where id = v_session.promoted_duel_match_id for update;

    if v_final.current_round_number >= v_final.rounds_total then
      perform system_finish_duel_match(v_final.id);
      update live_quiz_sessions
      set flow_state = 'champion',
          flow_deadline_at = null,
          updated_at = v_now
      where id = p_session_id;
    else
      update duel_matches
      set current_round_number = current_round_number + 1,
          phase = 'ready'
      where id = v_final.id;

      update live_quiz_sessions
      set flow_state = 'final_prepare',
          flow_deadline_at = v_now + make_interval(secs => greatest(1, coalesce(prepare_seconds, 3))),
          updated_at = v_now
      where id = p_session_id;
    end if;
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id;
  return json_build_object('flowState', v_session.flow_state, 'deadlineAt', v_session.flow_deadline_at);
end;
$$;

grant execute on function tick_current_dynamic_flow(uuid) to anon, authenticated;

-- Pausa global: agora congela também o cronômetro das semifinais/final.
create or replace function presenter_pause_current_dynamic(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_remaining_ms bigint;
  v_now timestamptz := now();
begin
  if not is_current_live_dynamic(p_session_id) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;
  if v_session.paused then
    return json_build_object('paused', true, 'flowState', v_session.flow_state);
  end if;

  v_remaining_ms := case
    when v_session.flow_deadline_at is null then null
    else greatest(0, (extract(epoch from (v_session.flow_deadline_at - v_now)) * 1000)::bigint)
  end;

  if v_session.flow_state = 'question' then
    update live_quiz_rounds
    set timer_accumulated_ms = timer_accumulated_ms + (extract(epoch from (v_now - timer_started_at)) * 1000)::bigint,
        timer_paused_at = v_now
    where session_id = p_session_id
      and round_number = v_session.current_question_number
      and not voided
      and timer_started_at is not null
      and timer_paused_at is null;
  elsif v_session.flow_state = 'semifinal_question' then
    update duel_rounds dr
    set timer_accumulated_ms = dr.timer_accumulated_ms + (extract(epoch from (v_now - dr.timer_started_at)) * 1000)::bigint,
        timer_paused_at = v_now
    where dr.match_id in (v_session.semifinal1_match_id, v_session.semifinal2_match_id)
      and dr.timer_started_at is not null
      and dr.timer_paused_at is null
      and not dr.voided;
  elsif v_session.flow_state = 'final_question' then
    update duel_rounds dr
    set timer_accumulated_ms = dr.timer_accumulated_ms + (extract(epoch from (v_now - dr.timer_started_at)) * 1000)::bigint,
        timer_paused_at = v_now
    where dr.match_id = v_session.promoted_duel_match_id
      and dr.timer_started_at is not null
      and dr.timer_paused_at is null
      and not dr.voided;
  end if;

  update live_quiz_sessions
  set paused = true,
      paused_from_flow_state = flow_state,
      flow_remaining_ms = v_remaining_ms,
      flow_deadline_at = null,
      updated_at = v_now
  where id = p_session_id;

  return json_build_object('paused', true, 'flowState', v_session.flow_state, 'remainingMs', v_remaining_ms);
end;
$$;

grant execute on function presenter_pause_current_dynamic(uuid) to anon, authenticated;

create or replace function presenter_resume_current_dynamic(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_now timestamptz := now();
  v_deadline timestamptz;
begin
  if not is_current_live_dynamic(p_session_id) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id for update;
  if not found then raise exception 'Dinâmica não encontrada'; end if;
  if not v_session.paused then
    return json_build_object('paused', false, 'flowState', v_session.flow_state, 'deadlineAt', v_session.flow_deadline_at);
  end if;

  v_deadline := case
    when v_session.flow_remaining_ms is null then null
    else v_now + (v_session.flow_remaining_ms * interval '1 millisecond')
  end;

  if v_session.paused_from_flow_state = 'question' then
    update live_quiz_rounds
    set timer_started_at = v_now, timer_paused_at = null
    where session_id = p_session_id
      and round_number = v_session.current_question_number
      and not voided
      and timer_paused_at is not null;
  elsif v_session.paused_from_flow_state = 'semifinal_question' then
    update duel_rounds
    set timer_started_at = v_now, timer_paused_at = null
    where match_id in (v_session.semifinal1_match_id, v_session.semifinal2_match_id)
      and not voided
      and timer_paused_at is not null;
  elsif v_session.paused_from_flow_state = 'final_question' then
    update duel_rounds
    set timer_started_at = v_now, timer_paused_at = null
    where match_id = v_session.promoted_duel_match_id
      and not voided
      and timer_paused_at is not null;
  end if;

  update live_quiz_sessions
  set paused = false,
      flow_deadline_at = v_deadline,
      flow_remaining_ms = null,
      paused_from_flow_state = null,
      updated_at = v_now
  where id = p_session_id;

  return json_build_object('paused', false, 'flowState', v_session.flow_state, 'deadlineAt', v_deadline);
end;
$$;

grant execute on function presenter_resume_current_dynamic(uuid) to anon, authenticated;

create or replace function presenter_finish_current_dynamic(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
begin
  if not is_current_live_dynamic(p_session_id) then
    raise exception 'Esta não é a dinâmica atual';
  end if;

  select * into v_session from live_quiz_sessions where id = p_session_id;

  update duel_matches
  set status = case when status = 'finished' then status else 'cancelled' end,
      ended_at = coalesce(ended_at, now())
  where id in (v_session.semifinal1_match_id, v_session.semifinal2_match_id, v_session.promoted_duel_match_id);

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
