-- Suporte a 4 finalistas em formato de chave: 2 semifinais (1x1) e uma
-- final entre os vencedores. Numa transação separada da que cria
-- live_quiz_phase (00000000000016) — adicionar e já usar um valor de enum
-- na mesma transação não é seguro no Postgres.

alter type live_quiz_phase add value 'duel_semifinals';
alter type live_quiz_phase add value 'duel_final';

alter table live_quiz_sessions
  add column semifinal1_match_id uuid references duel_matches (id) on delete set null,
  add column semifinal2_match_id uuid references duel_matches (id) on delete set null;

comment on column live_quiz_sessions.promoted_duel_match_id is 'Com finalists_count=2, é o único duelo final. Com finalists_count=4, é a FINAL entre os vencedores das semifinais (semifinal1_match_id/semifinal2_match_id).';

alter table live_quiz_sessions drop constraint live_quiz_sessions_finalists_count_check;
alter table live_quiz_sessions add constraint live_quiz_sessions_finalists_count_check check (finalists_count in (2, 4));
alter table live_quiz_sessions alter column finalists_count set default 4;

-- Liga cada duel_player criado a partir de uma promoção do quiz coletivo
-- de volta ao participante original — necessário para localizar a
-- promoção seguinte (vencedor de semifinal -> jogador da final) a partir
-- da tela do duelo, já que o jogador não está mais olhando a tela do quiz
-- quando a final é criada.
alter table duel_players
  add column promoted_from_live_quiz_participant_id uuid references live_quiz_participants (id) on delete set null;
