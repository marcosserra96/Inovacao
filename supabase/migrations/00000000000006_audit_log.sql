-- Registro de ações administrativas/apresentador que alteram estado
-- (anular pergunta, corrigir pontuação, definir vencedor manual, etc.).

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references admin_profiles (user_id),
  actor_role text,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_entity on audit_log (entity, entity_id);
create index idx_audit_log_actor on audit_log (actor_id);

create function log_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role::text into v_role from admin_profiles where user_id = auth.uid();
  insert into audit_log (actor_id, actor_role, action, entity, entity_id, payload)
  values (auth.uid(), v_role, p_action, p_entity, p_entity_id, p_payload);
end;
$$;
