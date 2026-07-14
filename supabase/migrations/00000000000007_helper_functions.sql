-- Funções auxiliares reutilizadas pelas policies de RLS e pelas RPCs dos dois modos.

create function current_admin_role()
returns admin_role
language sql
security definer
stable
set search_path = public
as $$
  select role from admin_profiles where user_id = auth.uid();
$$;

-- Retornam sempre um booleano não nulo (nunca NULL): em PL/pgSQL
-- "if not <null> then ..." é tratado como falso e NÃO dispara a exceção,
-- então uma função que devolvesse NULL para um chamador não autenticado
-- deixaria passar a checagem de autorização em vez de bloquear.
create function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(current_admin_role() = 'admin', false);
$$;

create function is_admin_or_presenter()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(current_admin_role() in ('admin', 'presenter'), false);
$$;

-- Código curto (6 caracteres, alfabeto sem caracteres ambíguos) usado para
-- entrada em sessões individuais e partidas de duelo.
create function generate_join_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Fórmula de pontuação (seção 7 do briefing):
--   errada  -> 0 (ou -penalty_wrong, se penalidade habilitada)
--   correta -> base_points + floor(speed_bonus_max * tempo_restante/tempo_total)
--              + bônus de sequência, se habilitado
-- Todos os parâmetros variáveis vêm de scoring_configs/questions — nada é
-- fixo em código, o admin ajusta pelo painel (Fase 3).
create function compute_points(
  p_is_correct boolean,
  p_base_points int,
  p_speed_bonus_max int,
  p_elapsed_ms bigint,
  p_total_ms bigint,
  p_enable_streak boolean,
  p_current_streak int,
  p_streak_bonus int,
  p_streak_cap int,
  p_enable_penalty boolean,
  p_penalty_wrong int
)
returns int
language plpgsql
immutable
as $$
declare
  remaining_ratio numeric;
  speed_bonus int;
  streak_component int := 0;
  points int;
begin
  if not p_is_correct then
    if p_enable_penalty then
      return -p_penalty_wrong;
    end if;
    return 0;
  end if;

  remaining_ratio := greatest(0, least(1, (p_total_ms - p_elapsed_ms)::numeric / greatest(p_total_ms, 1)));
  speed_bonus := floor(p_speed_bonus_max * remaining_ratio)::int;

  if p_enable_streak then
    streak_component := p_streak_bonus * least(p_current_streak, p_streak_cap);
  end if;

  points := p_base_points + speed_bonus + streak_component;
  return greatest(points, 0);
end;
$$;
