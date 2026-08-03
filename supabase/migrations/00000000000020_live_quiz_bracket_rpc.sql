-- RPCs do formato de 4 finalistas em chave (2 semifinais + final).

-- Cria um duel_match já pronto pra jogar (sem lobby, disputantes fixos) a
-- partir de uma lista ordenada de live_quiz_participants, e devolve o id
-- do duelo. Reaproveitada por presenter_start_duel_from_live_quiz (final
-- direta com 2 finalistas, ou as duas semifinais com 4) e por
-- presenter_start_live_quiz_final (final entre os vencedores das semis).
create function create_live_quiz_duel_match(
  p_session_id uuid,
  p_match_name text,
  p_participant_ids uuid[]
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

-- Substitui a versão de 00000000000017 (que só sabia lidar com 2
-- finalistas). Com finalists_count=2, continua criando um único duelo
-- final. Com finalists_count=4, cria as duas semifinais (seed 1x4 e 2x3,
-- pra evitar que os dois melhores colocados se enfrentem antes da final).
create or replace function presenter_start_duel_from_live_quiz(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_finalist_ids uuid[];
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

    v_semi1_id := create_live_quiz_duel_match(
      p_session_id, coalesce(v_session.name, 'Duelo') || ' — Semifinal 1', array[v_finalist_ids[1], v_finalist_ids[4]]
    );
    v_semi2_id := create_live_quiz_duel_match(
      p_session_id, coalesce(v_session.name, 'Duelo') || ' — Semifinal 2', array[v_finalist_ids[2], v_finalist_ids[3]]
    );

    update live_quiz_sessions
    set semifinal1_match_id = v_semi1_id, semifinal2_match_id = v_semi2_id, phase = 'duel_semifinals'
    where id = p_session_id;
    perform log_audit('start_semifinals_from_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('semi1', v_semi1_id, 'semi2', v_semi2_id));
    return json_build_object('semifinal1MatchId', v_semi1_id, 'semifinal2MatchId', v_semi2_id);
  end if;
end;
$$;

-- Só existe no formato de 4 finalistas: cria a final entre os vencedores
-- das duas semifinais, assim que ambas estiverem encerradas com um
-- vencedor definido (o apresentador sempre pode declarar um vencedor
-- manualmente em caso de empate, então isso nunca trava o fluxo).
create function presenter_start_live_quiz_final(p_session_id uuid)
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
    array[v_winner1_participant, v_winner2_participant]
  );

  update live_quiz_sessions set promoted_duel_match_id = v_match_id, phase = 'duel_final' where id = p_session_id;
  perform log_audit('start_final_from_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('matchId', v_match_id));

  return json_build_object('matchId', v_match_id);
end;
$$;

grant execute on function presenter_start_live_quiz_final(uuid) to authenticated;

-- Chamada pela tela do duelo (não mais a do quiz — o jogador já navegou
-- pra lá) quando a partida atual termina: descobre se esse jogador venceu
-- uma semifinal e foi promovido para uma nova partida (a final), e devolve
-- a nova identidade pra trocar de tela sozinho de novo.
create function get_my_live_quiz_reentry(p_duel_player_id uuid, p_duel_join_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_live_quiz_participant_id uuid;
  v_current_promoted_id uuid;
  v_new_join_token uuid;
begin
  if not exists (
    select 1 from duel_player_secrets where player_id = p_duel_player_id and join_token = p_duel_join_token
  ) then
    raise exception 'Sessão inválida — recarregue a página e entre novamente';
  end if;

  select promoted_from_live_quiz_participant_id into v_live_quiz_participant_id
  from duel_players where id = p_duel_player_id;

  if v_live_quiz_participant_id is null then
    return json_build_object('promoted', false);
  end if;

  select promoted_duel_player_id into v_current_promoted_id
  from live_quiz_participants where id = v_live_quiz_participant_id;

  if v_current_promoted_id is null or v_current_promoted_id = p_duel_player_id then
    return json_build_object('promoted', false);
  end if;

  select join_token into v_new_join_token from duel_player_secrets where player_id = v_current_promoted_id;

  return json_build_object(
    'promoted', true,
    'duelMatchId', (select match_id from duel_players where id = v_current_promoted_id),
    'duelPlayerId', v_current_promoted_id,
    'duelJoinToken', v_new_join_token
  );
end;
$$;

grant execute on function get_my_live_quiz_reentry(uuid, uuid) to anon, authenticated;
