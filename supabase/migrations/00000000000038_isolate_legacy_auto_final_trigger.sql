-- Impede o gatilho legado de iniciar a final automaticamente no fluxo novo.
-- O novo apresentador controla semifinal -> final manualmente.

create or replace function auto_start_live_quiz_final()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session live_quiz_sessions%rowtype;
  v_other_finished boolean;
begin
  if new.status <> 'finished' or new.winner_player_id is null then
    return new;
  end if;

  if old.status = 'finished' and old.winner_player_id is not distinct from new.winner_player_id then
    return new;
  end if;

  select * into v_session
  from live_quiz_sessions
  where (semifinal1_match_id = new.id or semifinal2_match_id = new.id)
    and promoted_duel_match_id is null;

  if not found then
    return new;
  end if;

  if v_session.flow_state in (
    'semifinal_prepare',
    'semifinal_question',
    'semifinal_reveal',
    'semifinal_result',
    'final_prepare',
    'final_question',
    'final_reveal',
    'champion',
    'finished'
  ) then
    return new;
  end if;

  select not exists (
    select 1
    from duel_matches
    where id in (v_session.semifinal1_match_id, v_session.semifinal2_match_id)
      and (status <> 'finished' or winner_player_id is null)
  ) into v_other_finished;

  if v_other_finished then
    perform presenter_start_live_quiz_final(v_session.id);
  end if;

  return new;
end;
$$;
