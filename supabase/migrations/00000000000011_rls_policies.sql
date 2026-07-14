-- Row Level Security. Princípio adotado: toda mutação sensível (pontuação,
-- avanço de fase, revelação de resposta) acontece exclusivamente através
-- das funções SECURITY DEFINER das migrations anteriores — por isso quase
-- nenhuma tabela recebe grant de INSERT/UPDATE/DELETE para anon/authenticated;
-- as únicas exceções são as telas de administração (CRUD de conteúdo), que
-- não têm lógica server-authoritative para proteger.

alter table admin_profiles enable row level security;
alter table event_settings enable row level security;
alter table categories enable row level security;
alter table scoring_configs enable row level security;
alter table question_sets enable row level security;
alter table question_set_items enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table individual_sessions enable row level security;
alter table participants enable row level security;
alter table individual_attempts enable row level security;
alter table individual_answers enable row level security;
alter table duel_matches enable row level security;
alter table duel_players enable row level security;
alter table duel_rounds enable row level security;
alter table duel_answers enable row level security;
alter table duel_answer_flags enable row level security;
alter table audit_log enable row level security;

-- admin_profiles ---------------------------------------------------------
grant select on admin_profiles to authenticated;
grant update (name) on admin_profiles to authenticated;
grant update (role) on admin_profiles to authenticated;
grant delete on admin_profiles to authenticated;

create policy admin_profiles_select on admin_profiles
  for select to authenticated
  using (auth.uid() = user_id or is_admin());

create policy admin_profiles_update on admin_profiles
  for update to authenticated
  using (is_admin())
  with check (is_admin());

create policy admin_profiles_delete on admin_profiles
  for delete to authenticated
  using (is_admin());

-- event_settings -----------------------------------------------------------
grant select on event_settings to anon, authenticated;
grant update on event_settings to authenticated;

create policy event_settings_select on event_settings for select to anon, authenticated using (true);
create policy event_settings_update on event_settings for update to authenticated using (is_admin()) with check (is_admin());

-- categories ---------------------------------------------------------------
grant select on categories to authenticated;
grant insert, update, delete on categories to authenticated;

create policy categories_select on categories for select to authenticated using (is_admin_or_presenter());
create policy categories_write on categories for all to authenticated using (is_admin()) with check (is_admin());

-- scoring_configs ------------------------------------------------------------
grant select on scoring_configs to authenticated;
grant insert, update, delete on scoring_configs to authenticated;

create policy scoring_configs_select on scoring_configs for select to authenticated using (is_admin_or_presenter());
create policy scoring_configs_write on scoring_configs for all to authenticated using (is_admin()) with check (is_admin());

-- question_sets / question_set_items ----------------------------------------
grant select on question_sets to authenticated;
grant insert, update, delete on question_sets to authenticated;
grant select on question_set_items to authenticated;
grant insert, update, delete on question_set_items to authenticated;

create policy question_sets_select on question_sets for select to authenticated using (is_admin_or_presenter());
create policy question_sets_write on question_sets for all to authenticated using (is_admin()) with check (is_admin());
create policy question_set_items_select on question_set_items for select to authenticated using (is_admin_or_presenter());
create policy question_set_items_write on question_set_items for all to authenticated using (is_admin()) with check (is_admin());

-- questions / question_options -----------------------------------------------
-- Nunca liberado para anon: participantes só recebem perguntas via RPC
-- (build_question_payload / get_public_duel_round_question), que omitem
-- a alternativa correta até a revelação.
grant select on questions to authenticated;
grant insert, update, delete on questions to authenticated;
grant select on question_options to authenticated;
grant insert, update, delete on question_options to authenticated;

create policy questions_select on questions for select to authenticated using (is_admin_or_presenter());
create policy questions_write on questions for all to authenticated using (is_admin()) with check (is_admin());
create policy question_options_select on question_options for select to authenticated using (is_admin_or_presenter());
create policy question_options_write on question_options for all to authenticated using (is_admin()) with check (is_admin());

-- individual_sessions --------------------------------------------------------
grant select on individual_sessions to anon, authenticated;
grant insert, update, delete on individual_sessions to authenticated;

create policy individual_sessions_select on individual_sessions for select to anon, authenticated using (true);
create policy individual_sessions_write on individual_sessions for all to authenticated using (is_admin()) with check (is_admin());

-- participants ----------------------------------------------------------------
-- Sem select/insert direto: criados por start_individual_attempt (RPC).
grant select, delete on participants to authenticated;

create policy participants_select on participants for select to authenticated using (is_admin_or_presenter());
create policy participants_delete on participants for delete to authenticated using (is_admin());

-- individual_attempts / individual_answers -------------------------------------
grant select, delete on individual_attempts to authenticated;
grant select, delete on individual_answers to authenticated;

create policy individual_attempts_select on individual_attempts for select to authenticated using (is_admin_or_presenter());
create policy individual_attempts_delete on individual_attempts for delete to authenticated using (is_admin());
create policy individual_answers_select on individual_answers for select to authenticated using (is_admin_or_presenter());
create policy individual_answers_delete on individual_answers for delete to authenticated using (is_admin());

-- duel_matches ------------------------------------------------------------------
-- Leitura pública (telão/participante/apresentador não têm dado sensível
-- aqui); escrita normal via RPC, UPDATE direto reservado para correções
-- administrativas emergenciais.
grant select on duel_matches to anon, authenticated;
grant update, delete on duel_matches to authenticated;

create policy duel_matches_select on duel_matches for select to anon, authenticated using (true);
create policy duel_matches_update on duel_matches for update to authenticated using (is_admin()) with check (is_admin());
create policy duel_matches_delete on duel_matches for delete to authenticated using (is_admin());

-- duel_players --------------------------------------------------------------------
grant select on duel_players to anon, authenticated;
grant update, delete on duel_players to authenticated;

create policy duel_players_select on duel_players for select to anon, authenticated using (true);
create policy duel_players_update on duel_players for update to authenticated using (is_admin()) with check (is_admin());
create policy duel_players_delete on duel_players for delete to authenticated using (is_admin());

-- duel_rounds -----------------------------------------------------------------------
grant select on duel_rounds to anon, authenticated;
grant update, delete on duel_rounds to authenticated;

create policy duel_rounds_select on duel_rounds for select to anon, authenticated using (true);
create policy duel_rounds_update on duel_rounds for update to authenticated using (is_admin()) with check (is_admin());
create policy duel_rounds_delete on duel_rounds for delete to authenticated using (is_admin());

-- duel_answer_flags -------------------------------------------------------------------
-- Projeção pública segura ("quem respondeu"); mantida só pelo trigger.
grant select on duel_answer_flags to anon, authenticated;

create policy duel_answer_flags_select on duel_answer_flags for select to anon, authenticated using (true);

-- duel_answers ------------------------------------------------------------------------
-- NUNCA select para anon: contém a alternativa escolhida e os pontos antes
-- da revelação oficial.
grant select, delete on duel_answers to authenticated;

create policy duel_answers_select on duel_answers for select to authenticated using (is_admin_or_presenter());
create policy duel_answers_delete on duel_answers for delete to authenticated using (is_admin());

-- audit_log -----------------------------------------------------------------------------
grant select on audit_log to authenticated;

create policy audit_log_select on audit_log for select to authenticated using (is_admin());
