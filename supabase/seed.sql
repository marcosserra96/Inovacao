-- Dados demonstrativos. Todas as perguntas abaixo têm is_demo = true para
-- ficarem claramente identificadas como exemplo — o conteúdo real sobre
-- inovação deve ser cadastrado pelo painel administrativo (Fase 3).

insert into categories (id, name) values
  ('00000000-0000-4000-8000-000000000001', 'Exemplo — Inovação')
on conflict do nothing;

insert into question_sets (id, name, description) values
  ('00000000-0000-4000-8000-000000000002', 'Conjunto de exemplo', 'Perguntas demonstrativas para testar a plataforma antes de cadastrar o conteúdo real do evento.')
on conflict do nothing;

-- Pergunta 1 — escolha única
insert into questions (id, statement, category_id, difficulty, type, time_limit_seconds, base_points, explanation, status, modes, is_demo)
values (
  '00000000-0000-4000-8000-000000000101',
  '[Exemplo] Qual destes é um princípio central do "design thinking"?',
  '00000000-0000-4000-8000-000000000001', 'easy', 'single_choice', 20, 100,
  'Design thinking parte da empatia com o usuário antes de definir soluções.',
  'active', '{individual,duel}', true
) on conflict do nothing;

insert into question_options (question_id, text, is_correct, position) values
  ('00000000-0000-4000-8000-000000000101', 'Empatia com o usuário', true, 0),
  ('00000000-0000-4000-8000-000000000101', 'Redução de custos a qualquer preço', false, 1),
  ('00000000-0000-4000-8000-000000000101', 'Seguir sempre o concorrente líder', false, 2),
  ('00000000-0000-4000-8000-000000000101', 'Evitar testes com usuários reais', false, 3)
on conflict do nothing;

-- Pergunta 2 — verdadeiro ou falso
insert into questions (id, statement, category_id, difficulty, type, time_limit_seconds, base_points, explanation, status, modes, is_demo)
values (
  '00000000-0000-4000-8000-000000000102',
  '[Exemplo] Um MVP (Produto Mínimo Viável) deve conter todas as funcionalidades planejadas para o produto final.',
  '00000000-0000-4000-8000-000000000001', 'medium', 'true_false', 15, 100,
  'O MVP contém apenas o essencial para validar uma hipótese com o menor esforço possível.',
  'active', '{individual,duel}', true
) on conflict do nothing;

insert into question_options (question_id, text, is_correct, position) values
  ('00000000-0000-4000-8000-000000000102', 'Verdadeiro', false, 0),
  ('00000000-0000-4000-8000-000000000102', 'Falso', true, 1)
on conflict do nothing;

-- Pergunta 3 — escolha única
insert into questions (id, statement, category_id, difficulty, type, time_limit_seconds, base_points, explanation, status, modes, is_demo)
values (
  '00000000-0000-4000-8000-000000000103',
  '[Exemplo] Qual metodologia é mais associada a ciclos curtos e iterativos de entrega?',
  '00000000-0000-4000-8000-000000000001', 'easy', 'single_choice', 20, 100,
  'Metodologias ágeis (como Scrum) trabalham em ciclos curtos chamados sprints.',
  'active', '{individual,duel}', true
) on conflict do nothing;

insert into question_options (question_id, text, is_correct, position) values
  ('00000000-0000-4000-8000-000000000103', 'Cascata (Waterfall)', false, 0),
  ('00000000-0000-4000-8000-000000000103', 'Metodologias ágeis', true, 1),
  ('00000000-0000-4000-8000-000000000103', 'Planejamento quinquenal', false, 2),
  ('00000000-0000-4000-8000-000000000103', 'Auditoria contínua', false, 3)
on conflict do nothing;

-- Pergunta 4 — difícil
insert into questions (id, statement, category_id, difficulty, type, time_limit_seconds, base_points, explanation, status, modes, is_demo)
values (
  '00000000-0000-4000-8000-000000000104',
  '[Exemplo] O que caracteriza uma "inovação disruptiva", segundo Clayton Christensen?',
  '00000000-0000-4000-8000-000000000001', 'hard', 'single_choice', 25, 150,
  'Inovação disruptiva cria um novo mercado ou segmento simples/acessível que eventualmente desloca concorrentes estabelecidos.',
  'active', '{individual,duel}', true
) on conflict do nothing;

insert into question_options (question_id, text, is_correct, position) values
  ('00000000-0000-4000-8000-000000000104', 'Uma melhoria incremental de um produto já existente', false, 0),
  ('00000000-0000-4000-8000-000000000104', 'Um novo mercado mais simples e acessível que desloca líderes estabelecidos', true, 1),
  ('00000000-0000-4000-8000-000000000104', 'Uma fusão entre duas grandes empresas do mesmo setor', false, 2),
  ('00000000-0000-4000-8000-000000000104', 'Um aumento de preço justificado por marketing', false, 3)
on conflict do nothing;

-- Pergunta 5 — verdadeiro ou falso
insert into questions (id, statement, category_id, difficulty, type, time_limit_seconds, base_points, explanation, status, modes, is_demo)
values (
  '00000000-0000-4000-8000-000000000105',
  '[Exemplo] Falhar rápido e aprender com o erro é uma prática recomendada em times inovadores.',
  '00000000-0000-4000-8000-000000000001', 'easy', 'true_false', 15, 100,
  '"Fail fast, learn fast" é um princípio comum em times de inovação e produtos ágeis.',
  'active', '{individual,duel}', true
) on conflict do nothing;

insert into question_options (question_id, text, is_correct, position) values
  ('00000000-0000-4000-8000-000000000105', 'Verdadeiro', true, 0),
  ('00000000-0000-4000-8000-000000000105', 'Falso', false, 1)
on conflict do nothing;

insert into question_set_items (question_set_id, question_id, position) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 0),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', 1),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 2),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000104', 3),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000105', 4)
on conflict do nothing;

-- Sessão individual de exemplo, em rascunho (o admin abre quando quiser testar).
insert into individual_sessions (
  id, name, code, question_set_id, scoring_config_id, question_count,
  question_order, shuffle_options, allow_retry, require_identification,
  show_correct_answer, show_ranking, ranking_size, status
)
select
  '00000000-0000-4000-8000-000000000201',
  'Sessão de exemplo',
  'DEMO01',
  '00000000-0000-4000-8000-000000000002',
  sc.id,
  5, 'fixed', true, true, true, true, true, 10, 'draft'
from scoring_configs sc where sc.is_default limit 1
on conflict do nothing;
