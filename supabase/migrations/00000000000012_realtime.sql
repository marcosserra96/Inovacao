-- Habilita Supabase Realtime (postgres_changes) apenas nas tabelas que não
-- carregam dado sensível (ver RLS na migration anterior) — telão,
-- participante e apresentador sincronizam a partir destas.

alter publication supabase_realtime add table duel_matches;
alter publication supabase_realtime add table duel_players;
alter publication supabase_realtime add table duel_rounds;
alter publication supabase_realtime add table duel_answer_flags;

-- REPLICA IDENTITY FULL garante que eventos de UPDATE/DELETE carreguem o
-- registro completo (necessário para o cliente reconciliar estado antigo).
alter table duel_matches replica identity full;
alter table duel_players replica identity full;
alter table duel_rounds replica identity full;
alter table duel_answer_flags replica identity full;
