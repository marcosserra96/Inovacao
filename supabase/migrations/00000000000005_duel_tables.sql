-- Modo 2 — Duelo ao vivo (1x1, controlado pelo apresentador, exibido no telão).

create table duel_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  question_set_id uuid not null references question_sets (id),
  scoring_config_id uuid not null references scoring_configs (id),
  rounds_total int not null default 5 check (rounds_total > 0),
  rounds_mode duel_rounds_mode not null default 'fixed_count',
  win_condition duel_win_condition not null default 'score',
  same_time_for_both boolean not null default true,
  end_on_both_answered boolean not null default true,
  enable_speed_bonus boolean not null default true,
  enable_penalty boolean not null default false,
  penalty_wrong int not null default 0 check (penalty_wrong >= 0),
  phase duel_phase not null default 'waiting_players',
  current_round_number int not null default 0,
  presenter_id uuid references admin_profiles (user_id),
  screen_message text,
  locked boolean not null default false,
  winner_player_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  status duel_match_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table duel_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references duel_matches (id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#5b21f0',
  is_active_disputant boolean not null default false,
  connected boolean not null default true,
  total_score int not null default 0,
  correct_count int not null default 0,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create index idx_duel_players_match on duel_players (match_id);

alter table duel_matches
  add constraint fk_duel_matches_winner
  foreign key (winner_player_id) references duel_players (id) on delete set null;

create table duel_rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references duel_matches (id) on delete cascade,
  round_number int not null,
  question_id uuid references questions (id),
  phase duel_phase not null default 'ready',
  timer_started_at timestamptz,
  timer_duration_seconds int not null default 20,
  timer_paused_at timestamptz,
  timer_accumulated_ms bigint not null default 0,
  revealed_at timestamptz,
  voided boolean not null default false,
  winner_player_id uuid references duel_players (id),
  created_at timestamptz not null default now(),
  unique (match_id, round_number)
);

create index idx_duel_rounds_match on duel_rounds (match_id);

comment on column duel_rounds.timer_accumulated_ms is 'Tempo já decorrido antes da última pausa; somado ao tempo desde timer_started_at quando o cronômetro está rodando.';

-- Respostas do duelo: contém a alternativa escolhida e a pontuação, por isso
-- NUNCA recebe select público (ver RLS) — o placar "quem respondeu" público
-- vem de duel_answer_flags, que não carrega esses campos sensíveis.
create table duel_answers (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references duel_rounds (id) on delete cascade,
  player_id uuid not null references duel_players (id) on delete cascade,
  option_id uuid references question_options (id),
  is_correct boolean not null default false,
  is_late boolean not null default false,
  response_time_ms int,
  points_awarded int not null default 0,
  answered_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table duel_answer_flags (
  round_id uuid not null references duel_rounds (id) on delete cascade,
  player_id uuid not null references duel_players (id) on delete cascade,
  answered boolean not null default false,
  answered_at timestamptz,
  primary key (round_id, player_id)
);

comment on table duel_answer_flags is 'Projeção pública e seletiva de duel_answers: só diz SE o jogador respondeu, nunca o quê. Segura para Realtime.';

create function sync_duel_answer_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into duel_answer_flags (round_id, player_id, answered, answered_at)
  values (new.round_id, new.player_id, true, new.answered_at)
  on conflict (round_id, player_id) do update set answered = true, answered_at = excluded.answered_at;
  return new;
end;
$$;

create trigger on_duel_answer_insert
  after insert on duel_answers
  for each row execute function sync_duel_answer_flag();
