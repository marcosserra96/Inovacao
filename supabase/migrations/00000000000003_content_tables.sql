-- Banco de perguntas: categorias, perguntas, alternativas, conjuntos e
-- configuração de pontuação (fórmula editável sem alterar código).

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table scoring_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- pontos concedidos por acerto vêm de questions.base_points; os campos
  -- abaixo controlam os bônus/penalidades aplicados sobre esse valor.
  speed_bonus_max int not null default 100 check (speed_bonus_max >= 0),
  enable_streak_bonus boolean not null default false,
  streak_bonus int not null default 20 check (streak_bonus >= 0),
  streak_bonus_cap int not null default 5 check (streak_bonus_cap >= 0),
  enable_penalty boolean not null default false,
  penalty_wrong int not null default 0 check (penalty_wrong >= 0),
  -- ordem de critérios de desempate, documentada aqui para referência do
  -- admin; a view de ranking aplica a ordem descrita na seção 6 do briefing
  -- (pontuação, acertos, tempo total, horário de conclusão).
  tie_break_rules jsonb not null default '["score", "correct_count", "total_time", "finished_at"]',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_default_scoring_config on scoring_configs (is_default) where is_default;

insert into scoring_configs (name, is_default) values ('Padrão', true);

create table question_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  statement text not null,
  category_id uuid references categories (id) on delete set null,
  difficulty question_difficulty not null default 'medium',
  type question_type not null default 'single_choice',
  time_limit_seconds int not null default 20 check (time_limit_seconds > 0),
  base_points int not null default 100 check (base_points >= 0),
  media_url text,
  explanation text,
  status question_status not null default 'active',
  modes game_mode[] not null default '{individual,duel}',
  tags text[] not null default '{}',
  is_demo boolean not null default false,
  author_id uuid references admin_profiles (user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column questions.is_demo is 'Marca perguntas de exemplo carregadas via seed, para diferenciá-las do conteúdo real do evento.';

create table question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position int not null default 0,
  unique (question_id, position)
);

-- Toda pergunta de escolha única/verdadeiro-falso deve ter exatamente uma
-- alternativa correta; aplicado pela função abaixo (constraint declarativa
-- não alcança "exatamente uma" de forma simples entre linhas).
create function check_single_correct_option()
returns trigger
language plpgsql
as $$
declare
  correct_count int;
  q_type question_type;
begin
  select type into q_type from questions where id = coalesce(new.question_id, old.question_id);
  if q_type in ('single_choice', 'true_false', 'tiebreaker') then
    select count(*) into correct_count
    from question_options
    where question_id = coalesce(new.question_id, old.question_id) and is_correct;
    if correct_count > 1 then
      raise exception 'Perguntas de escolha única devem ter apenas uma alternativa correta';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_single_correct_option
  after insert or update on question_options
  for each row execute function check_single_correct_option();

create table question_set_items (
  question_set_id uuid not null references question_sets (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  position int not null default 0,
  primary key (question_set_id, question_id)
);

create index idx_questions_category on questions (category_id);
create index idx_questions_status on questions (status);
create index idx_question_options_question on question_options (question_id);
create index idx_question_set_items_set on question_set_items (question_set_id);
