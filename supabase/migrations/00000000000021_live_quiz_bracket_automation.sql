-- Simplificação do fluxo do apresentador, a pedido de quem organiza o
-- evento: (1) as duplas das semifinais agora são sorteadas de verdade, não
-- seedadas pelo ranking — mais simples de explicar ("foi sorteio") e mais
-- divertido para o público; (2) a final é criada automaticamente assim que
-- as duas semifinais terminam, sem precisar de mais um clique.

-- Substitui a versão de 00000000000020 só na formação das semifinais: em
-- vez de 1ºx4º/2ºx3º, embaralha os 4 finalistas e divide em 2 duplas.
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

    -- Sorteio real das duplas (não seed por colocação) — pedido explícito
    -- de quem organiza o evento: mais simples de anunciar ao vivo.
    -- O ORDER BY precisa estar numa subconsulta: array_agg já agrega tudo
    -- numa única linha, então "order by random()" na consulta externa não
    -- faria nada (não há mais o que reordenar).
    select array_agg(id) into v_shuffled from (select id from unnest(v_finalist_ids) as id order by random()) shuffled;

    v_semi1_id := create_live_quiz_duel_match(
      p_session_id, coalesce(v_session.name, 'Duelo') || ' — Semifinal 1', array[v_shuffled[1], v_shuffled[2]]
    );
    v_semi2_id := create_live_quiz_duel_match(
      p_session_id, coalesce(v_session.name, 'Duelo') || ' — Semifinal 2', array[v_shuffled[3], v_shuffled[4]]
    );

    update live_quiz_sessions
    set semifinal1_match_id = v_semi1_id, semifinal2_match_id = v_semi2_id, phase = 'duel_semifinals'
    where id = p_session_id;
    perform log_audit('start_semifinals_from_quiz', 'live_quiz_sessions', p_session_id, jsonb_build_object('semi1', v_semi1_id, 'semi2', v_semi2_id));
    return json_build_object('semifinal1MatchId', v_semi1_id, 'semifinal2MatchId', v_semi2_id);
  end if;
end;
$$;

-- Dispara sempre que uma partida de duelo é encerrada; se ela for uma das
-- semifinais de um quiz coletivo e a outra semifinal também já tiver
-- terminado com vencedor definido, cria a final automaticamente — o
-- apresentador não precisa clicar em nada, só abrir o painel da final
-- quando estiver pronto.
--
-- auth.uid() dentro do trigger continua sendo o de quem chamou
-- presenter_end_match (mesma transação/sessão), então
-- presenter_start_live_quiz_final() é chamada com a mesma autorização de
-- apresentador de quem encerrou a partida — não precisa de uma versão
-- "interna" sem checagem.
create function auto_start_live_quiz_final()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_other_finished boolean;
begin
  if new.status <> 'finished' or new.winner_player_id is null then
    return new;
  end if;
  -- Só prossegue se algo relevante mudou nesta atualização (status acabou
  -- de virar "finished", ou o vencedor foi corrigido depois — ex.: o
  -- apresentador declarou um vencedor manual após um empate total). Evita
  -- reprocessar em updates não relacionados (mensagem pro telão, etc.).
  if old.status = 'finished' and old.winner_player_id is not distinct from new.winner_player_id then
    return new;
  end if;

  select * into v_session from live_quiz_sessions
  where (semifinal1_match_id = new.id or semifinal2_match_id = new.id)
    and promoted_duel_match_id is null;

  if not found then
    return new;
  end if;

  select not exists (
    select 1 from duel_matches
    where id in (v_session.semifinal1_match_id, v_session.semifinal2_match_id)
      and (status <> 'finished' or winner_player_id is null)
  ) into v_other_finished;

  if v_other_finished then
    perform presenter_start_live_quiz_final(v_session.id);
  end if;

  return new;
end;
$$;

create trigger on_semifinal_match_finished
  after update on duel_matches
  for each row execute function auto_start_live_quiz_final();
