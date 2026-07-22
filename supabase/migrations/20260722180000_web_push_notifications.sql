alter table public.notification_preferences
  add column push_enabled boolean not null default false,
  add column timezone text not null default 'America/Sao_Paulo',
  add column quiet_hours_start time not null default '22:00',
  add column quiet_hours_end time not null default '07:00',
  add column task_reminder_minutes smallint not null default 15
    check (task_reminder_minutes between 0 and 1440);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 4096),
  p256dh text not null check (char_length(p256dh) between 40 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  user_agent text check (char_length(user_agent) <= 500),
  failure_count smallint not null default 0 check (failure_count >= 0),
  last_error text check (char_length(last_error) <= 1000),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_dispatch_idx
  on public.push_subscriptions (user_id, workspace_id)
  where disabled_at is null;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_key text not null check (char_length(reminder_key) between 1 and 300),
  channel text not null default 'web_push' check (channel = 'web_push'),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  action_path text not null check (action_path like '/%'),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed', 'cancelled')),
  attempts smallint not null default 0 check (attempts >= 0),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text check (char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, reminder_key, channel)
);

create index notification_outbox_dispatch_idx
  on public.notification_outbox (coalesce(next_attempt_at, scheduled_for), created_at)
  where status in ('pending', 'retry', 'processing');

create table public.notification_delivery_attempts (
  id bigint generated always as identity primary key,
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outcome text not null check (outcome in ('sent', 'retryable_error', 'permanent_error')),
  status_code integer,
  error_message text check (char_length(error_message) <= 1000),
  created_at timestamptz not null default now()
);

create index notification_delivery_attempts_user_idx
  on public.notification_delivery_attempts (user_id, created_at desc);

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();
create trigger notification_outbox_updated_at
  before update on public.notification_outbox
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_delivery_attempts enable row level security;

create policy "push_subscriptions_owner_access"
  on public.push_subscriptions for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "notification_outbox_owner_select"
  on public.notification_outbox for select
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "notification_delivery_attempts_owner_select"
  on public.notification_delivery_attempts for select
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.notification_outbox to authenticated;
grant select on public.notification_delivery_attempts to authenticated;

create or replace function public.resolve_push_schedule(
  p_target timestamptz,
  p_timezone text,
  p_quiet_start time,
  p_quiet_end time
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  local_target timestamp := timezone(p_timezone, p_target);
  local_time time := local_target::time;
  resume_local timestamp;
begin
  if p_quiet_start = p_quiet_end then
    return p_target;
  end if;

  if p_quiet_start < p_quiet_end and local_time >= p_quiet_start and local_time < p_quiet_end then
    resume_local := local_target::date + p_quiet_end;
  elsif p_quiet_start > p_quiet_end and local_time >= p_quiet_start then
    resume_local := local_target::date + interval '1 day' + p_quiet_end;
  elsif p_quiet_start > p_quiet_end and local_time < p_quiet_end then
    resume_local := local_target::date + p_quiet_end;
  else
    return p_target;
  end if;

  return resume_local at time zone p_timezone;
end;
$$;

create or replace function public.enqueue_due_push_notifications(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  update public.notification_outbox outbox
  set status = 'cancelled', locked_at = null, next_attempt_at = null,
    last_error = 'Tarefa concluída, removida ou replanejada antes da entrega.'
  where outbox.channel = 'web_push'
    and outbox.status in ('pending', 'retry')
    and outbox.reminder_key like 'task-before:%'
    and not exists (
      select 1
      from public.tasks task
      where task.workspace_id = outbox.workspace_id
        and task.created_by = outbox.user_id
        and task.status not in ('completed', 'cancelled')
        and task.deleted_at is null
        and task.planned_date is not null
        and task.planned_start_time is not null
        and outbox.reminder_key = 'task-before:' || task.id::text || ':' || task.planned_date::text || ':' || task.planned_start_time::text
    );

  with eligible as (
    select
      preference.*,
      timezone(preference.timezone, p_now) as local_now,
      date_trunc('week', timezone(preference.timezone, p_now))::date as week_start
    from public.notification_preferences preference
    where preference.push_enabled
      and exists (
        select 1 from public.push_subscriptions subscription
        where subscription.workspace_id = preference.workspace_id
          and subscription.user_id = preference.user_id
          and subscription.disabled_at is null
      )
  ), candidates as (
    select
      eligible.workspace_id,
      eligible.user_id,
      'task-before:' || task.id::text || ':' || task.planned_date::text || ':' || task.planned_start_time::text as reminder_key,
      task.title as title,
      'Começa às ' || to_char(task.planned_start_time, 'HH24:MI') || ' · ' || task.estimated_minutes::text || ' min.' as body,
      '/tarefas'::text as action_path,
      public.resolve_push_schedule(
        (task.planned_date + task.planned_start_time) at time zone eligible.timezone
          - make_interval(mins => eligible.task_reminder_minutes),
        eligible.timezone,
        eligible.quiet_hours_start,
        eligible.quiet_hours_end
      ) as scheduled_for,
      ((task.planned_date + task.planned_start_time) at time zone eligible.timezone) as expires_at
    from eligible
    join public.tasks task
      on task.workspace_id = eligible.workspace_id
      and task.created_by = eligible.user_id
    where eligible.task_reminders
      and task.status not in ('completed', 'cancelled')
      and task.deleted_at is null
      and task.planned_date is not null
      and task.planned_start_time is not null
      and (task.planned_date + task.planned_start_time) at time zone eligible.timezone
        - make_interval(mins => eligible.task_reminder_minutes) <= p_now
      and (task.planned_date + task.planned_start_time) at time zone eligible.timezone > p_now

    union all

    select
      eligible.workspace_id,
      eligible.user_id,
      'daily-digest:' || eligible.local_now::date::text,
      'Seu dia no Meu Ritmo',
      count(task.id)::text || case when count(task.id) = 1 then ' tarefa aberta planejada para hoje.' else ' tarefas abertas planejadas para hoje.' end,
      '/hoje',
      public.resolve_push_schedule(
        (eligible.local_now::date + eligible.daily_digest_time) at time zone eligible.timezone,
        eligible.timezone,
        eligible.quiet_hours_start,
        eligible.quiet_hours_end
      ),
      null::timestamptz
    from eligible
    join public.tasks task
      on task.workspace_id = eligible.workspace_id
      and task.created_by = eligible.user_id
      and task.planned_date = eligible.local_now::date
      and task.status not in ('completed', 'cancelled')
      and task.deleted_at is null
    where eligible.task_reminders
      and eligible.local_now::time >= eligible.daily_digest_time
    group by eligible.id, eligible.workspace_id, eligible.user_id, eligible.local_now,
      eligible.daily_digest_time, eligible.timezone, eligible.quiet_hours_start, eligible.quiet_hours_end

    union all

    select
      eligible.workspace_id,
      eligible.user_id,
      'daily-review:' || eligible.local_now::date::text,
      'Como foi seu dia?',
      'Registre seu humor, energia e uma intenção para amanhã.',
      '/revisao',
      public.resolve_push_schedule(
        (eligible.local_now::date + eligible.review_reminder_time) at time zone eligible.timezone,
        eligible.timezone,
        eligible.quiet_hours_start,
        eligible.quiet_hours_end
      ),
      null::timestamptz
    from eligible
    where eligible.daily_review_reminders
      and eligible.local_now::time >= eligible.review_reminder_time
      and not exists (
        select 1 from public.daily_reviews review
        where review.workspace_id = eligible.workspace_id
          and review.user_id = eligible.user_id
          and review.review_date = eligible.local_now::date
      )

    union all

    select
      eligible.workspace_id,
      eligible.user_id,
      'weekly-review:' || eligible.week_start::text,
      'Hora de fechar a semana',
      'Revise seus avanços e escolha as prioridades da próxima semana.',
      '/revisao-semanal',
      public.resolve_push_schedule(p_now, eligible.timezone, eligible.quiet_hours_start, eligible.quiet_hours_end),
      null::timestamptz
    from eligible
    where eligible.weekly_review_reminders
      and extract(isodow from eligible.local_now)::smallint >= eligible.weekly_review_day
      and eligible.local_now::time >= eligible.review_reminder_time
      and not exists (
        select 1 from public.weekly_reviews review
        where review.workspace_id = eligible.workspace_id
          and review.user_id = eligible.user_id
          and review.week_start = eligible.week_start
      )
  )
  insert into public.notification_outbox (
    workspace_id, user_id, reminder_key, title, body, action_path, scheduled_for
  )
  select workspace_id, user_id, reminder_key, title, body, action_path, scheduled_for
  from candidates
  where (expires_at is null or scheduled_for < expires_at)
  on conflict (workspace_id, user_id, reminder_key, channel) do update
    set title = excluded.title,
      body = excluded.body,
      action_path = excluded.action_path,
      scheduled_for = excluded.scheduled_for,
      status = 'pending',
      attempts = 0,
      next_attempt_at = null,
      locked_at = null,
      sent_at = null,
      last_error = null
    where notification_outbox.status = 'cancelled';

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.claim_push_notifications(
  p_limit integer default 50,
  p_now timestamptz default now()
)
returns table (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  reminder_key text,
  title text,
  body text,
  action_path text,
  attempts smallint,
  max_attempts smallint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with claimable as (
    select outbox.id
    from public.notification_outbox outbox
    where (
        outbox.status in ('pending', 'retry')
        and coalesce(outbox.next_attempt_at, outbox.scheduled_for) <= p_now
      ) or (
        outbox.status = 'processing'
        and outbox.locked_at < p_now - interval '10 minutes'
      )
    order by coalesce(outbox.next_attempt_at, outbox.scheduled_for), outbox.created_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  ), claimed as (
    update public.notification_outbox outbox
    set status = 'processing', locked_at = p_now, attempts = outbox.attempts + 1
    from claimable
    where outbox.id = claimable.id
    returning outbox.*
  )
  select claimed.id, claimed.workspace_id, claimed.user_id, claimed.reminder_key,
    claimed.title, claimed.body, claimed.action_path, claimed.attempts, claimed.max_attempts
  from claimed;
$$;

create or replace function public.register_push_subscription(
  p_workspace_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Usuário sem acesso ao workspace.';
  end if;
  if char_length(p_endpoint) not between 20 and 4096
    or char_length(p_p256dh) not between 40 and 512
    or char_length(p_auth) not between 8 and 256
    or char_length(coalesce(p_user_agent, '')) > 500 then
    raise exception 'Assinatura push inválida.';
  end if;

  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (
    workspace_id, user_id, endpoint, p256dh, auth, user_agent
  ) values (
    p_workspace_id, auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent
  );
end;
$$;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  delete from public.push_subscriptions
  where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.resolve_push_schedule(timestamptz, text, time, time) from public, anon, authenticated;
revoke all on function public.enqueue_due_push_notifications(timestamptz) from public, anon, authenticated;
revoke all on function public.claim_push_notifications(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.register_push_subscription(uuid, text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.enqueue_due_push_notifications(timestamptz) to service_role;
grant execute on function public.claim_push_notifications(integer, timestamptz) to service_role;
grant execute on function public.register_push_subscription(uuid, text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;
