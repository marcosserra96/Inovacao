-- Corrige uma falha de autorização encontrada em revisão: duel_players.id
-- precisa ser público (usado no placar e no lobby), mas também era usado
-- como prova de posse do jogador em submit_duel_answer. Como qualquer
-- participante consegue ler os ids de todos os jogadores via select
-- público em duel_players, isso permitia que um jogador enviasse
-- respostas em nome do adversário.
--
-- O token secreto (join_token) fica em uma TABELA SEPARADA
-- (duel_player_secrets), sem nenhum grant para anon/authenticated e sem
-- entrar na publicação supabase_realtime. Column-level GRANT sozinho não
-- seria suficiente aqui: o Realtime replica a linha inteira a partir do
-- WAL e filtra por RLS (linha), não por coluna — colocar o segredo em uma
-- tabela própria, fora da publicação, é a única forma de garantir que ele
-- nunca é transmitido a um cliente anônimo.

create table duel_player_secrets (
  player_id uuid primary key references duel_players (id) on delete cascade,
  join_token uuid not null default gen_random_uuid()
);

alter table duel_player_secrets enable row level security;
-- Nenhuma policy criada de propósito: sem policy, RLS nega tudo por
-- padrão, mesmo para authenticated. Só funções SECURITY DEFINER acessam.

create or replace function join_duel_match(p_code text, p_display_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match duel_matches%rowtype;
  v_player_id uuid;
  v_join_token uuid;
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

  insert into duel_player_secrets (player_id) values (v_player_id)
  returning join_token into v_join_token;

  if v_match.phase = 'waiting_players' then
    update duel_matches set phase = 'players_connected' where id = v_match.id;
  end if;

  return json_build_object('matchId', v_match.id, 'playerId', v_player_id, 'joinToken', v_join_token, 'code', v_match.code);
end;
$$;

drop function if exists submit_duel_answer(uuid, uuid, uuid);

create function submit_duel_answer(p_round_id uuid, p_player_id uuid, p_join_token uuid, p_option_id uuid)
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
  if not exists (
    select 1 from duel_player_secrets where player_id = p_player_id and join_token = p_join_token
  ) then
    raise exception 'Sessão de jogador inválida — recarregue a página e entre novamente';
  end if;

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

grant execute on function submit_duel_answer(uuid, uuid, uuid, uuid) to anon, authenticated;

-- presenter_set_player_connected passa a ser exclusiva do apresentador
-- (não mais autoatendida pelo próprio jogador): permitir que o cliente se
-- marque como "conectado" desfaria, sem querer, um desconectar deliberado
-- do apresentador. Como todo estado do jogo vive no banco e cada tela
-- reconstrói a partir de um select + inscrição no Realtime ao montar, a
-- reconexão automática após queda de rede já funciona sem precisar dessa
-- chamada — ela agora serve só para o apresentador reverter um "remover"
-- feito por engano.
revoke execute on function presenter_set_player_connected(uuid, boolean) from anon, authenticated;

create or replace function presenter_set_player_connected(p_player_id uuid, p_connected boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;
  update duel_players
  set connected = p_connected, left_at = case when p_connected then null else now() end
  where id = p_player_id;
end;
$$;

grant execute on function presenter_set_player_connected(uuid, boolean) to authenticated;
