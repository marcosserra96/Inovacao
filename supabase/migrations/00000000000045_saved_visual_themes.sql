-- Temas reutilizáveis. O tema é copiado para a sessão, preservando eventos anteriores.
create table if not exists public.quiz_visual_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null,
  subtitle text not null default '',
  primary_color text not null default '#a7d52c',
  secondary_color text not null default '#00b6da',
  background_color text not null default '#020d23',
  surface_color text not null default '#071936',
  logo_primary text,
  logo_secondary text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_theme_valid_name check (length(trim(name)) between 1 and 80),
  constraint quiz_theme_valid_title check (length(trim(title)) between 1 and 100),
  constraint quiz_theme_valid_subtitle check (length(subtitle) <= 150),
  constraint quiz_theme_valid_primary check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint quiz_theme_valid_secondary check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint quiz_theme_valid_background check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint quiz_theme_valid_surface check (surface_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint quiz_theme_valid_logos check (
    (logo_primary is null or (length(logo_primary) <= 350000 and (logo_primary like '/brand/%' or logo_primary ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')))
    and (logo_secondary is null or (length(logo_secondary) <= 350000 and (logo_secondary like '/brand/%' or logo_secondary ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')))
  )
);
alter table public.quiz_visual_themes enable row level security;
create policy quiz_visual_themes_read on public.quiz_visual_themes for select to anon,authenticated using (true);
grant select on public.quiz_visual_themes to anon,authenticated;
insert into public.quiz_visual_themes(name,title,subtitle,primary_color,secondary_color,background_color,surface_color,logo_primary,logo_secondary,is_system)
select 'Rota de Inovação','Rota de Inovação','', '#a7d52c','#00b6da','#020d23','#071936','/brand/energisa.png','/brand/enova.png',true
where not exists (select 1 from public.quiz_visual_themes where is_system=true);
create unique index if not exists quiz_visual_themes_system_singleton on public.quiz_visual_themes(is_system) where is_system=true;

alter table public.live_quiz_defaults add column if not exists visual_theme_id uuid references public.quiz_visual_themes(id) on delete set null;
alter table public.live_quiz_sessions add column if not exists visual_theme jsonb;
update public.live_quiz_defaults set visual_theme_id=(select id from public.quiz_visual_themes where is_system=true limit 1)
where id=true and visual_theme_id is null;

create or replace function public.quiz_visual_theme_as_json(p_theme public.quiz_visual_themes)
returns jsonb language sql stable set search_path=public as $$
select jsonb_build_object(
  'id',p_theme.id,'name',p_theme.name,'title',p_theme.title,'subtitle',p_theme.subtitle,
  'primaryColor',p_theme.primary_color,'secondaryColor',p_theme.secondary_color,
  'backgroundColor',p_theme.background_color,'surfaceColor',p_theme.surface_color,
  'logoPrimary',p_theme.logo_primary,'logoSecondary',p_theme.logo_secondary);
$$;
revoke all on function public.quiz_visual_theme_as_json(public.quiz_visual_themes) from public;

create or replace function public.quiz_set_session_visual_theme()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_theme public.quiz_visual_themes%rowtype;
begin
  if new.visual_theme is null then
    select t.* into v_theme from public.quiz_visual_themes t
    where t.id=(select visual_theme_id from public.live_quiz_defaults where id=true);
    if found then new.visual_theme:=public.quiz_visual_theme_as_json(v_theme); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_quiz_set_session_visual_theme on public.live_quiz_sessions;
create trigger trg_quiz_set_session_visual_theme before insert on public.live_quiz_sessions
for each row execute function public.quiz_set_session_visual_theme();

-- A configuração ativa vale apenas para novas dinâmicas e para uma dinâmica no lobby.
create or replace function public.presenter_select_visual_theme(p_theme_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_theme public.quiz_visual_themes%rowtype; v_json jsonb; v_session_id uuid;
begin
  select * into v_theme from public.quiz_visual_themes where id=p_theme_id;
  if not found then raise exception 'Tema não encontrado'; end if;
  v_json:=public.quiz_visual_theme_as_json(v_theme);
  update public.live_quiz_defaults set visual_theme_id=p_theme_id,updated_at=now() where id=true;
  select active_live_quiz_session_id into v_session_id from public.game_control where id=true;
  update public.live_quiz_sessions set visual_theme=v_json,updated_at=now()
    where id=v_session_id and flow_state='lobby';
  return v_json;
end;
$$;
revoke all on function public.presenter_select_visual_theme(uuid) from public;
grant execute on function public.presenter_select_visual_theme(uuid) to anon,authenticated;

create or replace function public.presenter_save_visual_theme(p_theme_id uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_theme public.quiz_visual_themes%rowtype;
begin
  if nullif(trim(p_data->>'name'),'') is null or nullif(trim(p_data->>'title'),'') is null
    then raise exception 'Nome e título são obrigatórios'; end if;
  if p_theme_id is null then
    insert into public.quiz_visual_themes(name,title,subtitle,primary_color,secondary_color,background_color,surface_color,logo_primary,logo_secondary)
    values(trim(p_data->>'name'),trim(p_data->>'title'),coalesce(p_data->>'subtitle',''),
      p_data->>'primaryColor',p_data->>'secondaryColor',p_data->>'backgroundColor',p_data->>'surfaceColor',
      nullif(p_data->>'logoPrimary',''),nullif(p_data->>'logoSecondary',''))
    returning * into v_theme;
  else
    update public.quiz_visual_themes set name=trim(p_data->>'name'), title=trim(p_data->>'title'),
      subtitle=coalesce(p_data->>'subtitle',''), primary_color=p_data->>'primaryColor',
      secondary_color=p_data->>'secondaryColor', background_color=p_data->>'backgroundColor',
      surface_color=p_data->>'surfaceColor',logo_primary=nullif(p_data->>'logoPrimary',''),
      logo_secondary=nullif(p_data->>'logoSecondary',''), updated_at=now()
    where id=p_theme_id and not is_system returning * into v_theme;
    if not found then raise exception 'Tema não encontrado ou padrão protegido. Duplique o tema padrão para editá-lo'; end if;
  end if;
  return public.quiz_visual_theme_as_json(v_theme);
end;
$$;
revoke all on function public.presenter_save_visual_theme(uuid,jsonb) from public;
grant execute on function public.presenter_save_visual_theme(uuid,jsonb) to anon,authenticated;

create or replace function public.presenter_delete_visual_theme(p_theme_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.live_quiz_defaults where visual_theme_id=p_theme_id) then
    raise exception 'Selecione outro tema antes de excluir este';
  end if;
  delete from public.quiz_visual_themes where id=p_theme_id and not is_system;
  if not found then raise exception 'Tema não encontrado ou padrão protegido'; end if;
end;
$$;
revoke all on function public.presenter_delete_visual_theme(uuid) from public;
grant execute on function public.presenter_delete_visual_theme(uuid) to anon,authenticated;
