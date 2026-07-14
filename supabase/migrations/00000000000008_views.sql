-- Views agregadas. Por serem de propriedade do papel que roda as migrations,
-- funcionam como uma projeção seletiva e segura das tabelas de base (o
-- participante nunca recebe select direto em individual_attempts/answers).

-- Ranking do modo individual: melhor tentativa finalizada de cada
-- participante, com os critérios de desempate da seção 6 do briefing.
create view v_individual_ranking as
with best_attempt as (
  select distinct on (participant_id)
    id as attempt_id,
    session_id,
    participant_id,
    total_score,
    correct_count,
    total_time_ms,
    finished_at
  from individual_attempts
  where status = 'finished'
  order by participant_id, total_score desc, correct_count desc, total_time_ms asc, finished_at asc
)
select
  ba.session_id,
  ba.participant_id,
  p.display_name,
  p.team,
  ba.total_score,
  ba.correct_count,
  ba.total_time_ms,
  ba.finished_at,
  rank() over (
    partition by ba.session_id
    order by ba.total_score desc, ba.correct_count desc, ba.total_time_ms asc, ba.finished_at asc
  ) as rank
from best_attempt ba
join participants p on p.id = ba.participant_id;

grant select on v_individual_ranking to anon, authenticated;

-- Estatísticas por pergunta (dificuldade percebida, tempo médio) — uso
-- exclusivo do painel administrativo. Combina respostas dos dois modos.
create view v_question_stats as
select
  q.id as question_id,
  q.statement,
  q.category_id,
  count(ans.*) filter (where ans.source = 'individual') as times_answered_individual,
  count(ans.*) filter (where ans.source = 'duel') as times_answered_duel,
  count(ans.*) as times_answered,
  round(avg(ans.is_correct::int) * 100, 1) as correct_rate_pct,
  round(avg(ans.time_ms)) as avg_time_ms
from questions q
left join (
  select question_id, is_correct, answer_time_ms as time_ms, 'individual' as source
  from individual_answers
  union all
  select dr.question_id, da.is_correct, da.response_time_ms as time_ms, 'duel' as source
  from duel_answers da
  join duel_rounds dr on dr.id = da.round_id
) ans on ans.question_id = q.id
group by q.id, q.statement, q.category_id;

grant select on v_question_stats to authenticated;
