-- Configuração persistente da dinâmica: as perguntas de cada etapa (e o
-- resto do formato) são configuradas UMA VEZ aqui, em vez de escolhidas de
-- novo a cada partida — "Iniciar dinâmica" (RPC abaixo) só lê esta
-- configuração e já cria/abre a sessão, sem formulário no meio.
create table live_quiz_defaults (
  id boolean primary key default true constraint live_quiz_defaults_singleton check (id),
  question_set_id uuid references question_sets (id) on delete set null,
  scoring_config_id uuid references scoring_configs (id) on delete set null,
  questions_total int not null default 10 check (questions_total > 0),
  show_ranking_after_question boolean not null default true,
  hide_statement_on_phone boolean not null default false,
  finalists_count int not null default 4 check (finalists_count in (2, 4)),
  duel_question_set_id uuid references question_sets (id) on delete set null,
  duel_scoring_config_id uuid references scoring_configs (id) on delete set null,
  duel_rounds_total int not null default 5 check (duel_rounds_total > 0),
  duel_win_condition duel_win_condition not null default 'score',
  updated_at timestamptz not null default now()
);

insert into live_quiz_defaults (id) values (true);

alter table live_quiz_defaults enable row level security;

grant select on live_quiz_defaults to authenticated;
grant update on live_quiz_defaults to authenticated;

create policy live_quiz_defaults_select on live_quiz_defaults for select to authenticated using (is_admin_or_presenter());
create policy live_quiz_defaults_update on live_quiz_defaults for update to authenticated using (is_admin()) with check (is_admin());

-- Cria e já abre o lobby de uma nova sessão a partir da configuração
-- salva — é a única chamada que "Iniciar dinâmica" precisa fazer.
create function presenter_start_live_quiz_from_defaults(p_name text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_defaults live_quiz_defaults%rowtype;
  v_session_id uuid;
  v_code text;
begin
  if not is_admin_or_presenter() then
    raise exception 'Ação restrita ao apresentador';
  end if;

  select * into v_defaults from live_quiz_defaults where id = true;

  if v_defaults.question_set_id is null or v_defaults.scoring_config_id is null then
    raise exception 'Configure as perguntas da dinâmica antes de iniciar (Controle da dinâmica → Configurar perguntas)';
  end if;

  insert into live_quiz_sessions (
    name, question_set_id, scoring_config_id, questions_total,
    show_ranking_after_question, hide_statement_on_phone,
    finalists_count, duel_question_set_id, duel_scoring_config_id,
    duel_rounds_total, duel_win_condition,
    status, phase, presenter_id
  )
  values (
    coalesce(nullif(trim(p_name), ''), 'Dinâmica — ' || to_char(now(), 'DD/MM HH24:MI')),
    v_defaults.question_set_id, v_defaults.scoring_config_id, v_defaults.questions_total,
    v_defaults.show_ranking_after_question, v_defaults.hide_statement_on_phone,
    v_defaults.finalists_count, v_defaults.duel_question_set_id, v_defaults.duel_scoring_config_id,
    v_defaults.duel_rounds_total, v_defaults.duel_win_condition,
    'lobby', 'lobby', auth.uid()
  )
  returning id, code into v_session_id, v_code;

  perform log_audit('start_live_quiz_from_defaults', 'live_quiz_sessions', v_session_id, null);

  return json_build_object('sessionId', v_session_id, 'code', v_code);
end;
$$;

grant execute on function presenter_start_live_quiz_from_defaults(text) to authenticated;
