-- Numa transação separada da que adicionou 'live_quiz' ao enum game_mode
-- (00000000000016) — o Postgres não permite usar um valor de enum recém-
-- adicionado na mesma transação em que foi criado.

-- Perguntas novas passam a valer para os três modos por padrão; quem
-- quiser restringir desmarca manualmente no admin.
alter table questions alter column modes set default '{individual,duel,live_quiz}';

-- Perguntas já cadastradas (inclusive as de exemplo) passam a valer também
-- para o quiz coletivo, para o conjunto de exemplo funcionar de imediato
-- num ensaio sem precisar retaguear pergunta por pergunta.
update questions set modes = array_append(modes, 'live_quiz'::game_mode)
where not ('live_quiz' = any(modes));

-- Uma pergunta de desempate de exemplo, para o roteiro de ensaio poder
-- testar o fluxo de empate sem depender do admin cadastrar uma antes.
insert into questions (id, statement, type, time_limit_seconds, base_points, explanation, status, modes, is_demo)
values (
  '00000000-0000-4000-8000-000000000301',
  '[Exemplo — desempate] Em que ano o Grupo Energisa foi fundado?',
  'tiebreaker',
  20,
  0,
  'Pergunta de desempate: vale só para decidir a ordem entre participantes empatados, não soma ao placar geral.',
  'active',
  '{live_quiz}',
  true
)
on conflict (id) do nothing;

insert into question_options (question_id, text, is_correct, position) values
  ('00000000-0000-4000-8000-000000000301', '1998', false, 0),
  ('00000000-0000-4000-8000-000000000301', '2000', true, 1),
  ('00000000-0000-4000-8000-000000000301', '2005', false, 2),
  ('00000000-0000-4000-8000-000000000301', '2010', false, 3)
on conflict do nothing;

insert into question_set_items (question_set_id, question_id, position)
select '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', 99
where exists (select 1 from question_sets where id = '00000000-0000-4000-8000-000000000002')
on conflict do nothing;

-- game_control passa a reconhecer o modo 'live_quiz' — o quiz coletivo é a
-- etapa 1 do evento; 'individual' continua existindo para outros usos
-- (trivia assíncrona fora do evento ao vivo).
alter table game_control drop constraint game_control_active_mode_check;
alter table game_control add constraint game_control_active_mode_check
  check (active_mode in ('none', 'individual', 'duel', 'live_quiz'));

alter table game_control add column active_live_quiz_session_id uuid references live_quiz_sessions (id) on delete set null;
