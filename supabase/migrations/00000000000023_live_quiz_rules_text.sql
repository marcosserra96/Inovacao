-- Regras do telão configuráveis (uma por linha) em vez de texto fixo no
-- frontend. "{finalistas}" no texto é substituído pelo número de
-- finalistas da sessão na hora de exibir.
alter table live_quiz_defaults add column rules_text text not null default
$$⚡ Uma pergunta por vez, para todo mundo ao mesmo tempo.
⏱️ Responda rápido — quanto mais rápido, mais pontos.
🔒 Só dá pra responder uma vez.
🏆 Os {finalistas} melhores avançam para o duelo ao vivo.$$;

alter table live_quiz_sessions add column rules_text text;

create or replace function presenter_start_live_quiz_from_defaults(p_name text default null)
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
    duel_rounds_total, duel_win_condition, rules_text,
    status, phase, presenter_id
  )
  values (
    coalesce(nullif(trim(p_name), ''), 'Dinâmica — ' || to_char(now(), 'DD/MM HH24:MI')),
    v_defaults.question_set_id, v_defaults.scoring_config_id, v_defaults.questions_total,
    v_defaults.show_ranking_after_question, v_defaults.hide_statement_on_phone,
    v_defaults.finalists_count, v_defaults.duel_question_set_id, v_defaults.duel_scoring_config_id,
    v_defaults.duel_rounds_total, v_defaults.duel_win_condition, v_defaults.rules_text,
    'lobby', 'lobby', auth.uid()
  )
  returning id, code into v_session_id, v_code;

  perform log_audit('start_live_quiz_from_defaults', 'live_quiz_sessions', v_session_id, null);

  return json_build_object('sessionId', v_session_id, 'code', v_code);
end;
$$;
