-- Exposição somente da identidade visual ativa para o quiz público.
-- As configurações privadas da dinâmica continuam protegidas por RLS.
create or replace function public.quiz_get_active_visual_theme()
returns jsonb language sql stable security definer set search_path=public as $$
  select public.quiz_visual_theme_as_json(t)
  from public.live_quiz_defaults d
  join public.quiz_visual_themes t on t.id=d.visual_theme_id
  where d.id=true
  limit 1;
$$;
revoke all on function public.quiz_get_active_visual_theme() from public;
grant execute on function public.quiz_get_active_visual_theme() to anon,authenticated;
