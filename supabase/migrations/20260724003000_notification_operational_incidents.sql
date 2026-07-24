create table public.notification_operational_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique check (char_length(incident_key) between 1 and 300),
  kind text not null check (kind in (
    'delivery_recurring_failure',
    'no_active_subscription',
    'dispatcher_failure'
  )),
  severity text not null check (severity in ('warning', 'error')),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  context jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reported_at timestamptz,
  sentry_event_id text check (char_length(sentry_event_id) <= 100),
  last_report_error text check (char_length(last_report_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_operational_incidents_pending_idx
  on public.notification_operational_incidents (last_seen_at desc)
  where reported_at is null;

create trigger notification_operational_incidents_updated_at
  before update on public.notification_operational_incidents
  for each row execute function public.set_updated_at();

alter table public.notification_operational_incidents enable row level security;
revoke all on public.notification_operational_incidents from anon, authenticated;
grant select, insert, update on public.notification_operational_incidents to service_role;

create or replace function public.register_notification_operational_incident(
  p_incident_key text,
  p_kind text,
  p_severity text,
  p_message text,
  p_workspace_id uuid default null,
  p_user_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns table (
  incident_id uuid,
  should_report boolean,
  occurrence_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;

  return query
  insert into public.notification_operational_incidents (
    incident_key,
    kind,
    severity,
    workspace_id,
    user_id,
    message,
    context
  )
  values (
    p_incident_key,
    p_kind,
    p_severity,
    p_workspace_id,
    p_user_id,
    left(p_message, 500),
    coalesce(p_context, '{}'::jsonb)
  )
  on conflict (incident_key) do update
  set
    occurrence_count = notification_operational_incidents.occurrence_count + 1,
    last_seen_at = now(),
    severity = excluded.severity,
    message = excluded.message,
    context = excluded.context
  returning
    notification_operational_incidents.id,
    notification_operational_incidents.reported_at is null,
    notification_operational_incidents.occurrence_count;
end;
$$;

revoke all on function public.register_notification_operational_incident(
  text, text, text, text, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.register_notification_operational_incident(
  text, text, text, text, uuid, uuid, jsonb
) to service_role;

comment on table public.notification_operational_incidents is
  'Private deduplication and audit ledger for external notification delivery alerts.';
