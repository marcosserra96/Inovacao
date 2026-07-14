-- Perfis administrativos (login real via Supabase Auth) e identidade visual do evento.

create table admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role admin_role not null default 'presenter',
  name text not null,
  created_at timestamptz not null default now()
);

comment on table admin_profiles is 'Papel (admin/apresentador) de cada usuário autenticado do Supabase Auth.';

-- Todo novo usuário do Supabase Auth recebe um perfil padrão de "presenter".
-- Promover a "admin" é uma ação manual (documentada no README de instalação),
-- evitando que o primeiro cadastro se auto-promova.
create function handle_new_admin_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into admin_profiles (user_id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email), 'presenter');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_admin_user();

-- Identidade visual configurável (logotipo, cores, mensagens). Tabela singleton.
create table event_settings (
  id boolean primary key default true constraint event_settings_singleton check (id),
  event_name text not null default 'Dinâmica de Inovação',
  dynamic_name text not null default 'Desafio da Inovação',
  primary_color text not null default '#0099cd',
  secondary_color text not null default '#26a3dd',
  accent_color text not null default '#fb8200',
  logo_url text,
  background_url text,
  welcome_message text not null default 'Prepare-se para testar o quanto você pensa fora da caixa.',
  result_message text not null default 'Obrigado por participar! Confira sua posição no ranking.',
  updated_at timestamptz not null default now()
);

insert into event_settings (id) values (true);
