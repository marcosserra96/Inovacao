-- Etapa 1 do evento: quiz coletivo ao vivo, sincronizado e controlado pelo
-- apresentador (não mais o "desafio individual" assíncrono). Arquitetura
-- espelha o duelo (duel_matches/duel_players/duel_rounds/duel_answers), que
-- já é, na prática, "um quiz ao vivo controlado pelo apresentador" — só que
-- travado em 2 jogadores. Aqui generalizamos o mesmo padrão comprovado
-- (token secreto fora do Realtime, fase por rodada, flags públicas de
-- "quem respondeu") para N participantes.
--
-- O modo "Desafio individual" (individual_sessions) continua existindo e
-- funcionando — não é removido — para outros usos (trivia assíncrona antes/
-- depois do evento). O quiz coletivo é a experiência da etapa 1 do evento.

-- Fase da rodada do quiz coletivo — deliberadamente um enum próprio (não
-- reaproveita duel_phase) para não precisar de ALTER TYPE ADD VALUE no tipo
-- do duelo (que exigiria cuidado transacional e arriscaria efeito colateral
-- em código já em produção). "ready" é o estado de descanso entre perguntas.
create type live_quiz_phase as enum (
  'lobby',
  'rules',
  'ready',
  'question_shown',
  'awaiting_answers',
  'time_up',
  'result_revealed',
  'ranking',
  'tiebreaker_question',
  'tiebreaker_answering',
  'tiebreaker_reveal',
  'finalists_reveal',
  'duel_ready',
  'quiz_finished'
);

-- Permite marcar perguntas específicas para o quiz coletivo (além de
-- individual/duel já existentes). O valor só passa a ser USADO (em
-- default/dados) numa migration seguinte — adicionar e usar um novo valor
-- de enum na mesma transação não é seguro no Postgres.
alter type game_mode add value 'live_quiz';

create table live_quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  question_set_id uuid not null references question_sets (id),
  scoring_config_id uuid not null references scoring_configs (id),
  -- Reaproveita duel_match_status: draft/lobby/in_progress/finished/cancelled
  -- descreve exatamente o ciclo de vida da sessão coletiva também.
  status duel_match_status not null default 'draft',
  phase live_quiz_phase not null default 'lobby',
  current_question_number int not null default 0,
  questions_total int not null default 10 check (questions_total > 0),
  lobby_locked boolean not null default false,
  hide_statement_on_phone boolean not null default false,
  show_ranking_after_question boolean not null default true,
  ranking_size int not null default 10 check (ranking_size > 0),
  enable_speed_bonus boolean not null default true,
  enable_penalty boolean not null default false,
  penalty_wrong int not null default 0 check (penalty_wrong >= 0),
  end_when_all_answered boolean not null default true,
  is_rehearsal boolean not null default false,
  -- Pausa de contingência (ex.: problema técnico) — congela a experiência
  -- visualmente nas telas públicas sem interromper a máquina de estados; o
  -- apresentador continua podendo operar e retomar quando quiser.
  paused boolean not null default false,
  -- Configuração da etapa 2 (duelo), definida com antecedência pelo admin —
  -- pode usar um conjunto de perguntas diferente do quiz coletivo.
  finalists_count int not null default 2 check (finalists_count = 2),
  duel_question_set_id uuid references question_sets (id),
  duel_scoring_config_id uuid references scoring_configs (id),
  duel_rounds_total int not null default 5 check (duel_rounds_total > 0),
  duel_win_condition duel_win_condition not null default 'score',
  presenter_id uuid references admin_profiles (user_id),
  screen_message text,
  promoted_duel_match_id uuid references duel_matches (id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column live_quiz_sessions.finalists_count is 'Fixo em 2 nesta versão (duelo final é 1x1); coluna existe para deixar configurável no futuro sem migration nova.';
comment on column live_quiz_sessions.is_rehearsal is 'Sessão de ensaio: mesma mecânica, mas o admin pode filtrá-la nos resultados/exportações reais.';

create table live_quiz_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_quiz_sessions (id) on delete cascade,
  display_name text not null,
  team text,
  device_fingerprint text,
  avatar_color text not null default '#5b21f0',
  connected boolean not null default true,
  total_score int not null default 0,
  correct_count int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  is_finalist boolean not null default false,
  is_spectator boolean not null default false,
  -- Preenchido quando promovido ao duelo: aponta para o novo duel_players
  -- criado automaticamente, para o próprio celular localizar sua nova
  -- identidade sem precisar reentrar (ver get_my_live_quiz_promotion).
  promoted_duel_player_id uuid references duel_players (id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index idx_live_quiz_participants_session on live_quiz_participants (session_id);
-- Restaura a participação automaticamente se o mesmo dispositivo tentar
-- entrar de novo na mesma sessão (F5, fechar/abrir o navegador).
create unique index uq_live_quiz_participant_device
  on live_quiz_participants (session_id, device_fingerprint)
  where device_fingerprint is not null;

-- Token de posse do participante — mesma solução de segurança do duelo
-- (ver 00000000000013): tabela própria, sem policy (RLS nega tudo por
-- padrão) e fora da publicação supabase_realtime, para nunca vazar via
-- Realtime a quem não é o dono.
create table live_quiz_participant_secrets (
  participant_id uuid primary key references live_quiz_participants (id) on delete cascade,
  join_token uuid not null default gen_random_uuid()
);

alter table live_quiz_participant_secrets enable row level security;

create table live_quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references live_quiz_sessions (id) on delete cascade,
  round_number int not null,
  question_id uuid references questions (id),
  phase live_quiz_phase not null default 'question_shown',
  timer_started_at timestamptz,
  timer_duration_seconds int not null default 20,
  timer_paused_at timestamptz,
  timer_accumulated_ms bigint not null default 0,
  revealed_at timestamptz,
  voided boolean not null default false,
  is_tiebreaker boolean not null default false,
  -- Preenchido só em rodadas de desempate: só estes participantes podem
  -- responder (os demais já estão fora da disputa pelo corte de finalistas).
  tiebreak_participant_ids uuid[],
  created_at timestamptz not null default now(),
  unique (session_id, round_number)
);

create index idx_live_quiz_rounds_session on live_quiz_rounds (session_id);

comment on column live_quiz_rounds.timer_accumulated_ms is 'Tempo já decorrido antes da última pausa; somado ao tempo desde timer_started_at quando o cronômetro está rodando.';

-- Respostas: contém a alternativa escolhida e os pontos, por isso NUNCA
-- select público (ver RLS) — a projeção pública "quem respondeu" vem de
-- live_quiz_answer_flags, que não carrega esses campos sensíveis.
create table live_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references live_quiz_rounds (id) on delete cascade,
  participant_id uuid not null references live_quiz_participants (id) on delete cascade,
  option_id uuid references question_options (id),
  is_correct boolean not null default false,
  is_late boolean not null default false,
  response_time_ms int,
  points_awarded int not null default 0,
  answered_at timestamptz not null default now(),
  unique (round_id, participant_id)
);

create table live_quiz_answer_flags (
  round_id uuid not null references live_quiz_rounds (id) on delete cascade,
  participant_id uuid not null references live_quiz_participants (id) on delete cascade,
  answered boolean not null default false,
  answered_at timestamptz,
  primary key (round_id, participant_id)
);

comment on table live_quiz_answer_flags is 'Projeção pública e seletiva de live_quiz_answers: só diz SE o participante respondeu, nunca o quê. Segura para Realtime.';

create function sync_live_quiz_answer_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into live_quiz_answer_flags (round_id, participant_id, answered, answered_at)
  values (new.round_id, new.participant_id, true, new.answered_at)
  on conflict (round_id, participant_id) do update set answered = true, answered_at = excluded.answered_at;
  return new;
end;
$$;

create trigger on_live_quiz_answer_insert
  after insert on live_quiz_answers
  for each row execute function sync_live_quiz_answer_flag();

create trigger live_quiz_sessions_assign_code
  before insert on live_quiz_sessions
  for each row execute function assign_join_code_trigger();

-- RLS -------------------------------------------------------------------
alter table live_quiz_sessions enable row level security;
alter table live_quiz_participants enable row level security;
alter table live_quiz_rounds enable row level security;
alter table live_quiz_answers enable row level security;
alter table live_quiz_answer_flags enable row level security;

-- live_quiz_sessions: leitura pública (telão/participante precisam ler
-- status/fase); escrita normal via RPC, UPDATE direto reservado para
-- correções administrativas emergenciais.
grant select on live_quiz_sessions to anon, authenticated;
grant insert, update, delete on live_quiz_sessions to authenticated;

create policy live_quiz_sessions_select on live_quiz_sessions for select to anon, authenticated using (true);
create policy live_quiz_sessions_insert on live_quiz_sessions for insert to authenticated with check (is_admin_or_presenter());
create policy live_quiz_sessions_update on live_quiz_sessions for update to authenticated using (is_admin()) with check (is_admin());
create policy live_quiz_sessions_delete on live_quiz_sessions for delete to authenticated using (is_admin());

-- live_quiz_participants: leitura pública (lobby, placar, telão); sem
-- insert direto (só via join_live_quiz).
grant select on live_quiz_participants to anon, authenticated;
grant update, delete on live_quiz_participants to authenticated;

create policy live_quiz_participants_select on live_quiz_participants for select to anon, authenticated using (true);
create policy live_quiz_participants_update on live_quiz_participants for update to authenticated using (is_admin()) with check (is_admin());
create policy live_quiz_participants_delete on live_quiz_participants for delete to authenticated using (is_admin());

-- live_quiz_rounds: leitura pública (nunca carrega resposta correta —
-- isso vem só via get_public_live_quiz_round_question/RPC).
grant select on live_quiz_rounds to anon, authenticated;
grant update, delete on live_quiz_rounds to authenticated;

create policy live_quiz_rounds_select on live_quiz_rounds for select to anon, authenticated using (true);
create policy live_quiz_rounds_update on live_quiz_rounds for update to authenticated using (is_admin()) with check (is_admin());
create policy live_quiz_rounds_delete on live_quiz_rounds for delete to authenticated using (is_admin());

-- live_quiz_answer_flags: projeção pública segura.
grant select on live_quiz_answer_flags to anon, authenticated;

create policy live_quiz_answer_flags_select on live_quiz_answer_flags for select to anon, authenticated using (true);

-- live_quiz_answers: NUNCA select para anon — contém a alternativa
-- escolhida e os pontos antes da revelação oficial.
grant select, delete on live_quiz_answers to authenticated;

create policy live_quiz_answers_select on live_quiz_answers for select to authenticated using (is_admin_or_presenter());
create policy live_quiz_answers_delete on live_quiz_answers for delete to authenticated using (is_admin());

-- live_quiz_participant_secrets: sem nenhuma policy de propósito — RLS nega
-- tudo por padrão, mesmo para authenticated. Só funções SECURITY DEFINER
-- acessam (mesmo padrão de duel_player_secrets).

-- Realtime ----------------------------------------------------------------
-- REPLICA IDENTITY FULL garante que eventos de UPDATE/DELETE carreguem o
-- registro completo (necessário para o cliente reconciliar estado antigo).
alter publication supabase_realtime add table live_quiz_sessions;
alter publication supabase_realtime add table live_quiz_participants;
alter publication supabase_realtime add table live_quiz_rounds;
alter publication supabase_realtime add table live_quiz_answer_flags;

alter table live_quiz_sessions replica identity full;
alter table live_quiz_participants replica identity full;
alter table live_quiz_rounds replica identity full;
alter table live_quiz_answer_flags replica identity full;
