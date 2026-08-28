-- Garante que novas sessões herdem o tempo por pergunta configurado no painel.

create or replace function apply_live_quiz_default_question_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select question_time_seconds
  into new.question_time_seconds
  from live_quiz_defaults
  where id = true;
  return new;
end;
$$;

drop trigger if exists trg_live_quiz_default_question_time on live_quiz_sessions;
create trigger trg_live_quiz_default_question_time
before insert on live_quiz_sessions
for each row execute function apply_live_quiz_default_question_time();
