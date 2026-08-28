-- Dá mais tempo de leitura às transições do fluxo novo.
-- A pergunta continua usando question_time_seconds; estes tempos valem para
-- prepare-se, resposta revelada e ranking entre perguntas.
alter table live_quiz_sessions
  alter column prepare_seconds set default 4,
  alter column reveal_seconds set default 5,
  alter column ranking_seconds set default 6;

-- Atualiza apenas sessões ainda abertas, preservando o histórico já encerrado.
update live_quiz_sessions
set prepare_seconds = 4,
    reveal_seconds = 5,
    ranking_seconds = 6,
    updated_at = now()
where status not in ('finished', 'cancelled');
