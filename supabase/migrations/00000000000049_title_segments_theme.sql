alter table public.quiz_visual_themes add column if not exists title_segments jsonb not null default '[]'::jsonb;
-- Apenas uma lista pequena de pares texto/cor; o frontend verifica a concatenação dos trechos.
alter table public.quiz_visual_themes add constraint quiz_visual_themes_title_segments_array check (jsonb_typeof(title_segments)='array' and jsonb_array_length(title_segments)<=150);
CREATE OR REPLACE FUNCTION public.quiz_visual_theme_as_json(p_theme quiz_visual_themes)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
select jsonb_build_object(
  'id',p_theme.id,'name',p_theme.name,'title',p_theme.title,'titleSegments',p_theme.title_segments,'subtitle',p_theme.subtitle,
  'primaryColor',p_theme.primary_color,'secondaryColor',p_theme.secondary_color,
  'backgroundColor',p_theme.background_color,'surfaceColor',p_theme.surface_color,
  'logoPrimary',p_theme.logo_primary,'logoSecondary',p_theme.logo_secondary);
$function$
;
CREATE OR REPLACE FUNCTION public.presenter_save_visual_theme(p_theme_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_theme public.quiz_visual_themes%rowtype;
begin
  if nullif(trim(p_data->>'name'),'') is null or nullif(trim(p_data->>'title'),'') is null
    then raise exception 'Nome e título são obrigatórios'; end if;
  if p_theme_id is null then
    insert into public.quiz_visual_themes(name,title,title_segments,subtitle,primary_color,secondary_color,background_color,surface_color,logo_primary,logo_secondary)
    values(trim(p_data->>'name'),trim(p_data->>'title'),coalesce(p_data->'titleSegments','[]'::jsonb),coalesce(p_data->>'subtitle',''),
      p_data->>'primaryColor',p_data->>'secondaryColor',p_data->>'backgroundColor',p_data->>'surfaceColor',
      nullif(p_data->>'logoPrimary',''),nullif(p_data->>'logoSecondary',''))
    returning * into v_theme;
  else
    update public.quiz_visual_themes set name=trim(p_data->>'name'), title=trim(p_data->>'title'),
      title_segments=coalesce(p_data->'titleSegments','[]'::jsonb), subtitle=coalesce(p_data->>'subtitle',''), primary_color=p_data->>'primaryColor',
      secondary_color=p_data->>'secondaryColor', background_color=p_data->>'backgroundColor',
      surface_color=p_data->>'surfaceColor',logo_primary=nullif(p_data->>'logoPrimary',''),
      logo_secondary=nullif(p_data->>'logoSecondary',''), updated_at=now()
    where id=p_theme_id and not is_system returning * into v_theme;
    if not found then raise exception 'Tema não encontrado ou padrão protegido. Duplique o tema padrão para editá-lo'; end if;
  end if;
  return public.quiz_visual_theme_as_json(v_theme);
end;
$function$
;
