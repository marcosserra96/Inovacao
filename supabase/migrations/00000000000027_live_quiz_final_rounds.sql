-- A etapa 2 (semifinais) e a etapa 3 (final) passam a sempre usar TODAS
-- as perguntas marcadas pra cada uma, em vez de um número de rodadas
-- configurado à parte (que podia ficar menor que o total marcado e
-- deixar perguntas de fora sem querer). O front-end agora manda
-- duel_rounds_total = nº de perguntas marcadas na etapa 2, e
-- final_rounds_total = nº de perguntas marcadas na etapa 3.
alter table live_quiz_sessions add column final_rounds_total int;
alter table live_quiz_defaults add column final_rounds_total int;

drop function if exists create_live_quiz_duel_match(uuid, text, uuid[], uuid);

create function create_live_quiz_duel_match(
  p_session_id uuid,
  p_match_name text,
  p_participant_ids uuid[],
  p_question_set_id_override uuid default null,
  p_rounds_total_override int default null
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
    coalesce(p_rounds_total_override, v_session.duel_rounds_total),
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
    v_session.final_question_set_id,
    v_session.final_rounds_total
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
    duel_rounds_total, duel_win_condition, rules_text, final_question_set_id, final_rounds_total,
    status, phase, presenter_id
  )
  values (
    coalesce(nullif(trim(p_name), ''), 'Dinâmica — ' || to_char(now(), 'DD/MM HH24:MI')),
    v_defaults.question_set_id, v_defaults.scoring_config_id, v_defaults.questions_total,
    v_defaults.show_ranking_after_question, v_defaults.hide_statement_on_phone,
    v_defaults.finalists_count, v_defaults.duel_question_set_id, v_defaults.duel_scoring_config_id,
    v_defaults.duel_rounds_total, v_defaults.duel_win_condition, v_defaults.rules_text,
    v_defaults.final_question_set_id, v_defaults.final_rounds_total,
    'lobby', 'lobby', auth.uid()
  )
  returning id, code into v_session_id, v_code;

  perform log_audit('start_live_quiz_from_defaults', 'live_quiz_sessions', v_session_id, null);

  return json_build_object('sessionId', v_session_id, 'code', v_code);
end;
$$;
