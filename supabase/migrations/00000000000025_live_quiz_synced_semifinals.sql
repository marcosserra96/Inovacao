-- As duas semifinais passam a ser "pareadas": mesma pergunta, mesmo
-- cronômetro, ao mesmo tempo, cada dupla disputando dentro do seu próprio
-- duel_match (a pontuação/vencedor de cada dupla continua 100% isolada —
-- só a pergunta e o ritmo são compartilhados). A final ganha um pool de
-- perguntas próprio (final_question_set_id) pra não repetir o que já caiu
-- nas semifinais.
alter table duel_matches add column paired_match_id uuid references duel_matches (id);
alter table live_quiz_sessions add column final_question_set_id uuid references question_sets (id) on delete set null;
alter table live_quiz_defaults add column final_question_set_id uuid references question_sets (id) on delete set null;

-- create or replace não cobre troca de assinatura (novo parâmetro) — sem
-- isso, ficariam duas versões sobrecarregadas e toda chamada com 3
-- argumentos vira ambígua.
drop function if exists create_live_quiz_duel_match(uuid, text, uuid[]);

create function create_live_quiz_duel_match(
  p_session_id uuid,
  p_match_name text,
  p_participant_ids uuid[],
  p_question_set_id_override uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_match_id uuid;
  v_player_id uuid;
  v_participant_id uuid;
  v_color text;
  v_palette text[] := array['#5b21f0', '#06b6c4'];
  v_i int := 0;
begin
  select * into v_session from live_quiz_sessions where id = p_session_id;

  insert into duel_matches (
    name, question_set_id, scoring_config_id, rounds_total, win_condition,
    presenter_id, status, phase, current_round_number, started_at
  )
  values (
    p_match_name,
    coalesce(p_question_set_id_override, v_session.duel_question_set_id, v_session.question_set_id),
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

  foreach v_participant_id in array p_participant_ids loop
    v_color := v_palette[1 + (v_i % array_length(v_palette, 1))];
    v_i := v_i + 1;

    insert into duel_players (match_id, display_name, avatar_color, is_active_disputant, promoted_from_live_quiz_participant_id)
    values (
      v_match_id,
      (select display_name from live_quiz_participants where id = v_participant_id),
      v_color,
      true,
      v_participant_id
    )
    returning id into v_player_id;

    insert into duel_player_secrets (player_id) values (v_player_id);

    update live_quiz_participants set promoted_duel_player_id = v_player_id where id = v_participant_id;
  end loop;

  return v_match_id;
end;
$$;

create or replace function presenter_start_duel_from_live_quiz(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_finalist_ids uuid[];
  v_shuffled uuid[];
  v_match_id uuid;
  v_semi1_id uuid;
  v_semi2_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_session from live_quiz_sessions where id = p_session_id for update;

  select array_agg(participant_id order by rank) into v_finalist_ids
  from v_live_quiz_ranking
  where session_id = p_session_id
    and participant_id in (select id from live_quiz_participants where session_id = p_session_id and is_finalist);

  if coalesce(array_length(v_finalist_ids, 1), 0) <> v_session.finalists_count then
    raise exception 'Selecione os % finalistas antes de iniciar o duelo', v_session.finalists_count;
  end if;

  if v_session.finalists_count = 2 then
    if v_session.promoted_duel_match_id is not null then
      return json_build_object('matchId', v_session.promoted_duel_match_id);
    end if;

    v_match_id := create_live_quiz_duel_match(p_session_id, coalesce(v_session.name, 'Duelo') || ' — Final', v_finalist_ids);

    update live_quiz_sessions set promoted_duel_match_id = v_match_id, phase = 'duel_ready' where id = p_session_id;
    perform log_audit('start_duel_from_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('matchId', v_match_id));
    return json_build_object('matchId', v_match_id);
  else
    if v_session.semifinal1_match_id is not null then
      return json_build_object('semifinal1MatchId', v_session.semifinal1_match_id, 'semifinal2MatchId', v_session.semifinal2_match_id);
    end if;

    select array_agg(id) into v_shuffled from (select id from unnest(v_finalist_ids) as id order by random()) shuffled;

    v_semi1_id := create_live_quiz_duel_match(
      p_session_id, coalesce(v_session.name, 'Duelo') || ' — Semifinal 1', array[v_shuffled[1], v_shuffled[2]]
    );
    v_semi2_id := create_live_quiz_duel_match(
      p_session_id, coalesce(v_session.name, 'Duelo') || ' — Semifinal 2', array[v_shuffled[3], v_shuffled[4]]
    );

    update duel_matches set paired_match_id = v_semi2_id where id = v_semi1_id;
    update duel_matches set paired_match_id = v_semi1_id where id = v_semi2_id;

    update live_quiz_sessions
    set semifinal1_match_id = v_semi1_id, semifinal2_match_id = v_semi2_id, phase = 'duel_semifinals'
    where id = p_session_id;
    perform log_audit('start_semifinals_from_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('semi1', v_semi1_id, 'semi2', v_semi2_id));
    return json_build_object('semifinal1MatchId', v_semi1_id, 'semifinal2MatchId', v_semi2_id);
  end if;
end;
$$;

create or replace function presenter_start_live_quiz_final(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_semi1 duel_matches%rowtype;
  v_semi2 duel_matches%rowtype;
  v_winner1_participant uuid;
  v_winner2_participant uuid;
  v_match_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_session from live_quiz_sessions where id = p_session_id for update;

  if v_session.finalists_count <> 4 then
    raise exception 'Este quiz não usa o formato de semifinais';
  end if;
  if v_session.semifinal1_match_id is null or v_session.semifinal2_match_id is null then
    raise exception 'As semifinais ainda não foram iniciadas';
  end if;
  if v_session.promoted_duel_match_id is not null then
    return json_build_object('matchId', v_session.promoted_duel_match_id);
  end if;

  select * into v_semi1 from duel_matches where id = v_session.semifinal1_match_id;
  select * into v_semi2 from duel_matches where id = v_session.semifinal2_match_id;

  if v_semi1.status <> 'finished' or v_semi2.status <> 'finished' then
    raise exception 'As duas semifinais precisam ser encerradas antes de iniciar a final';
  end if;
  if v_semi1.winner_player_id is null or v_semi2.winner_player_id is null then
    raise exception 'Cada semifinal precisa de um vencedor definido — use "Declarar vencedor" em caso de empate';
  end if;

  select promoted_from_live_quiz_participant_id into v_winner1_participant from duel_players where id = v_semi1.winner_player_id;
  select promoted_from_live_quiz_participant_id into v_winner2_participant from duel_players where id = v_semi2.winner_player_id;

  v_match_id := create_live_quiz_duel_match(
    p_session_id,
    coalesce(v_session.name, 'Duelo') || ' — Final',
    array[v_winner1_participant, v_winner2_participant],
    v_session.final_question_set_id
  );

  update live_quiz_sessions set promoted_duel_match_id = v_match_id, phase = 'duel_final' where id = p_session_id;
  perform log_audit('start_final_from_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('matchId', v_match_id));

  return json_build_object('matchId', v_match_id);
end;
$$;

create or replace function presenter_start_live_quiz_from_defaults(p_name text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_defaults live_quiz_defaults%rowtype;
  v_session_id uuid;
  v_code text;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;

  select * into v_defaults from live_quiz_defaults where id = true;

  if v_defaults.question_set_id is null or v_defaults.scoring_config_id is null then
    raise exception 'Configure as perguntas da dinâmica antes de iniciar (Controle da dinâmica → Configurar perguntas)';
  end if;

  insert into live_quiz_sessions (
    name, question_set_id, scoring_config_id, questions_total,
    show_ranking_after_question, hide_statement_on_phone,
    finalists_count, duel_question_set_id, duel_scoring_config_id,
    duel_rounds_total, duel_win_condition, rules_text, final_question_set_id,
    status, phase, presenter_id
  )
  values (
    coalesce(nullif(trim(p_name), ''), 'Dinâmica — ' || to_char(now(), 'DD/MM HH24:MI')),
    v_defaults.question_set_id, v_defaults.scoring_config_id, v_defaults.questions_total,
    v_defaults.show_ranking_after_question, v_defaults.hide_statement_on_phone,
    v_defaults.finalists_count, v_defaults.duel_question_set_id, v_defaults.duel_scoring_config_id,
    v_defaults.duel_rounds_total, v_defaults.duel_win_condition, v_defaults.rules_text, v_defaults.final_question_set_id,
    'lobby', 'lobby', auth.uid()
  )
  returning id, code into v_session_id, v_code;

  perform log_audit('start_live_quiz_from_defaults', 'live_quiz_sessions', v_session_id, null);

  return json_build_object('sessionId', v_session_id, 'code', v_code);
end;
$$;

-- A partir daqui: versões "pareadas" das ações do apresentador, que
-- aplicam a mesma ação nas DUAS semifinais de uma vez (mesma pergunta,
-- mesmo instante de início de cronômetro). Chame passando o id de
-- QUALQUER uma das duas semifinais — a função descobre a parceira.
create function presenter_show_paired_duel_question(p_match_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_partner duel_matches%rowtype;
  v_round_id uuid;
  v_partner_round_id uuid;
  v_question_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_match from duel_matches where id = p_match_id for update;
  if v_match.paired_match_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  select * into v_partner from duel_matches where id = v_match.paired_match_id for update;

  if v_match.current_round_number <> v_partner.current_round_number then
    raise exception 'As duplas estão em rodadas diferentes — não é possível sincronizar';
  end if;

  select id, question_id into v_round_id, v_question_id from duel_rounds
  where match_id = v_match.id and round_number = v_match.current_round_number and not voided;

  if v_round_id is null then
    select q.id into v_question_id
    from question_set_items qsi
    join questions q on q.id = qsi.question_id
    where qsi.question_set_id = v_match.question_set_id
      and q.status = 'active'
      and 'duel' = any(q.modes)
      and q.id not in (
        select question_id from duel_rounds where match_id in (v_match.id, v_partner.id) and question_id is not null
      )
    order by random()
    limit 1;

    if v_question_id is null then
      raise exception 'Não há mais perguntas disponíveis neste conjunto para o duelo';
    end if;

    insert into duel_rounds (match_id, round_number, question_id, phase, timer_duration_seconds)
    values (
      v_match.id, v_match.current_round_number, v_question_id, 'question_shown',
      coalesce((select time_limit_seconds from questions where id = v_question_id), 20)
    )
    returning id into v_round_id;
  else
    update duel_rounds set phase = 'question_shown' where id = v_round_id;
  end if;

  select id into v_partner_round_id from duel_rounds
  where match_id = v_partner.id and round_number = v_partner.current_round_number and not voided;

  if v_partner_round_id is null then
    insert into duel_rounds (match_id, round_number, question_id, phase, timer_duration_seconds)
    values (
      v_partner.id, v_partner.current_round_number, v_question_id, 'question_shown',
      coalesce((select time_limit_seconds from questions where id = v_question_id), 20)
    )
    returning id into v_partner_round_id;
  else
    update duel_rounds set phase = 'question_shown' where id = v_partner_round_id;
  end if;

  update duel_matches set phase = 'question_shown' where id in (v_match.id, v_partner.id);
  perform log_audit('show_paired_question', 'duel_rounds', v_round_id, jsonb_build_object('partnerRoundId', v_partner_round_id));

  return json_build_object('roundId', v_round_id, 'partnerRoundId', v_partner_round_id);
end;
$$;

grant execute on function presenter_show_paired_duel_question(uuid) to authenticated;

create function presenter_start_paired_duel_timer(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_now timestamptz := now();
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select * into v_match from duel_matches where id = p_match_id;
  if v_match.paired_match_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;

  update duel_rounds
  set timer_started_at = v_now, timer_paused_at = null, timer_accumulated_ms = 0, phase = 'awaiting_answers'
  where match_id in (v_match.id, v_match.paired_match_id)
    and round_number = v_match.current_round_number and not voided;

  update duel_matches set phase = 'awaiting_answers' where id in (v_match.id, v_match.paired_match_id);
end;
$$;

grant execute on function presenter_start_paired_duel_timer(uuid) to authenticated;

create function presenter_pause_paired_duel_timer(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select paired_match_id into v_partner_id from duel_matches where id = p_match_id;
  if v_partner_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  perform presenter_pause_timer(p_match_id);
  perform presenter_pause_timer(v_partner_id);
end;
$$;

grant execute on function presenter_pause_paired_duel_timer(uuid) to authenticated;

create function presenter_resume_paired_duel_timer(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select paired_match_id into v_partner_id from duel_matches where id = p_match_id;
  if v_partner_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  perform presenter_resume_timer(p_match_id);
  perform presenter_resume_timer(v_partner_id);
end;
$$;

grant execute on function presenter_resume_paired_duel_timer(uuid) to authenticated;

create function presenter_end_paired_duel_question_early(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select paired_match_id into v_partner_id from duel_matches where id = p_match_id;
  if v_partner_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  perform presenter_end_question_early(p_match_id);
  perform presenter_end_question_early(v_partner_id);
end;
$$;

grant execute on function presenter_end_paired_duel_question_early(uuid) to authenticated;

create function presenter_reveal_paired_duel_answer(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select paired_match_id into v_partner_id from duel_matches where id = p_match_id;
  if v_partner_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  perform presenter_reveal_answer(p_match_id);
  perform presenter_reveal_answer(v_partner_id);
end;
$$;

grant execute on function presenter_reveal_paired_duel_answer(uuid) to authenticated;

create function presenter_void_paired_duel_question(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select paired_match_id into v_partner_id from duel_matches where id = p_match_id;
  if v_partner_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  perform presenter_void_question(p_match_id);
  perform presenter_void_question(v_partner_id);
end;
$$;

grant execute on function presenter_void_paired_duel_question(uuid) to authenticated;

create function presenter_restart_paired_duel_round(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select paired_match_id into v_partner_id from duel_matches where id = p_match_id;
  if v_partner_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  perform presenter_restart_round(p_match_id);
  perform presenter_restart_round(v_partner_id);
end;
$$;

grant execute on function presenter_restart_paired_duel_round(uuid) to authenticated;

create function presenter_next_paired_duel_round(p_match_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_result json;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  select paired_match_id into v_partner_id from duel_matches where id = p_match_id;
  if v_partner_id is null then
    raise exception 'Esta partida não está pareada com outra';
  end if;
  v_result := presenter_next_round(p_match_id);
  perform presenter_next_round(v_partner_id);
  return v_result;
end;
$$;

grant execute on function presenter_next_paired_duel_round(uuid) to authenticated;
