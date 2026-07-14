-- Modo 1 — Desafio individual aberto.

create table individual_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  question_set_id uuid not null references question_sets (id),
  scoring_config_id uuid not null references scoring_configs (id),
  opens_at timestamptz,
  closes_at timestamptz,
  question_count int not null default 10 check (question_count > 0),
  question_order question_order_mode not null default 'random',
  shuffle_options boolean not null default true,
  time_limit_seconds int check (time_limit_seconds > 0),
  allow_retry boolean not null default false,
  require_identification boolean not null default true,
  show_correct_answer boolean not null default true,
  show_ranking boolean not null default true,
  ranking_size int not null default 10 check (ranking_size > 0),
  status individual_session_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column individual_sessions.time_limit_seconds is 'Se nulo, usa o tempo definido em cada pergunta (questions.time_limit_seconds).';

create table participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references individual_sessions (id) on delete cascade,
  display_name text not null,
  team text,
  device_fingerprint text,
  created_at timestamptz not null default now()
);

create index idx_participants_session on participants (session_id);
create index idx_participants_device on participants (session_id, device_fingerprint);

create table individual_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references individual_sessions (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  question_ids uuid[] not null,
  option_order jsonb not null default '{}',
  current_index int not null default 0,
  current_question_started_at timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_score int not null default 0,
  correct_count int not null default 0,
  total_time_ms bigint not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress', 'finished', 'abandoned'))
);

create index idx_individual_attempts_session on individual_attempts (session_id);
create index idx_individual_attempts_participant on individual_attempts (participant_id);

create table individual_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references individual_attempts (id) on delete cascade,
  question_id uuid not null references questions (id),
  option_id uuid references question_options (id),
  is_correct boolean not null default false,
  is_late boolean not null default false,
  answer_time_ms int not null,
  points_awarded int not null default 0,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index idx_individual_answers_attempt on individual_answers (attempt_id);
