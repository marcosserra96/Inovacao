-- Controle centralizado de "qual jogo está rolando agora". Permite que o
-- admin defina o modo ativo (individual/duelo) e qual sessão/partida é a
-- vigente; a tela de entrada pública (HomePage) lê isso para levar cada
-- participante direto para o que ele deve jogar, sem precisar de um link
-- ou código diferente por atividade.

create table game_control (
  id boolean primary key default true constraint game_control_singleton check (id),
  active_mode text not null default 'none' check (active_mode in ('none', 'individual', 'duel')),
  active_individual_session_id uuid references individual_sessions (id) on delete set null,
  active_duel_match_id uuid references duel_matches (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into game_control (id) values (true);

alter table game_control enable row level security;

grant select on game_control to anon, authenticated;
grant update on game_control to authenticated;

create policy game_control_select on game_control for select to anon, authenticated using (true);
-- admin e apresentador podem trocar o jogo ativo (ex.: ao criar uma nova
-- partida de duelo, o apresentador a torna a partida vigente).
create policy game_control_update on game_control for update to authenticated using (is_admin_or_presenter()) with check (is_admin_or_presenter());

alter publication supabase_realtime add table game_control;
alter table game_control replica identity full;
