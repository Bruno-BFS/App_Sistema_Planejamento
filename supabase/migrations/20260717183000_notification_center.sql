create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  browser_enabled boolean not null default false,
  task_reminders boolean not null default true,
  daily_review_reminders boolean not null default true,
  weekly_review_reminders boolean not null default true,
  daily_digest_time time not null default '08:00',
  review_reminder_time time not null default '20:00',
  weekly_review_day smallint not null default 7 check (weekly_review_day between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.notification_dismissals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_key text not null check (char_length(reminder_key) between 1 and 300),
  dismissed_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, reminder_key)
);

create index notification_dismissals_active_idx
  on public.notification_dismissals (workspace_id, user_id, dismissed_until);

create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();
create trigger notification_dismissals_updated_at
  before update on public.notification_dismissals
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notification_dismissals enable row level security;

create policy "notification_preferences_owner_access"
  on public.notification_preferences for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "notification_dismissals_owner_access"
  on public.notification_dismissals for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.notification_dismissals to authenticated;

create or replace function public.get_personal_reminders(
  p_workspace_id uuid,
  p_local_date date,
  p_local_time time,
  p_week_start date
)
returns table (
  reminder_key text,
  kind text,
  title text,
  body text,
  action_path text,
  priority smallint,
  due_date date
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with settings as (
    select
      coalesce((select task_reminders from public.notification_preferences where workspace_id = p_workspace_id and user_id = auth.uid()), true) as task_reminders,
      coalesce((select daily_review_reminders from public.notification_preferences where workspace_id = p_workspace_id and user_id = auth.uid()), true) as daily_review_reminders,
      coalesce((select weekly_review_reminders from public.notification_preferences where workspace_id = p_workspace_id and user_id = auth.uid()), true) as weekly_review_reminders,
      coalesce((select daily_digest_time from public.notification_preferences where workspace_id = p_workspace_id and user_id = auth.uid()), time '08:00') as daily_digest_time,
      coalesce((select review_reminder_time from public.notification_preferences where workspace_id = p_workspace_id and user_id = auth.uid()), time '20:00') as review_reminder_time,
      coalesce((select weekly_review_day from public.notification_preferences where workspace_id = p_workspace_id and user_id = auth.uid()), 7) as weekly_review_day
  ), candidates as (
    select
      'task:' || task.id::text as reminder_key,
      case when task.planned_date < p_local_date then 'overdue_task' else 'today_task' end as kind,
      task.title,
      case
        when task.planned_date < p_local_date then 'Tarefa planejada para ' || to_char(task.planned_date, 'DD/MM/YYYY') || '.'
        else 'Planejada para hoje · ' || task.estimated_minutes::text || ' min.'
      end as body,
      '/tarefas'::text as action_path,
      (case when task.planned_date < p_local_date then 3 else 2 end)::smallint as priority,
      task.planned_date as due_date
    from public.tasks task
    cross join settings
    where settings.task_reminders
      and p_local_time >= settings.daily_digest_time
      and task.workspace_id = p_workspace_id
      and task.created_by = auth.uid()
      and task.status not in ('completed', 'cancelled')
      and task.planned_date <= p_local_date

    union all

    select
      'daily-review:' || p_local_date::text,
      'daily_review',
      'Como foi seu dia?',
      'Registre seu humor, energia e uma intenção para amanhã.',
      '/revisao',
      1::smallint,
      p_local_date
    from settings
    where settings.daily_review_reminders
      and p_local_time >= settings.review_reminder_time
      and not exists (
        select 1 from public.daily_reviews review
        where review.workspace_id = p_workspace_id
          and review.user_id = auth.uid()
          and review.review_date = p_local_date
      )

    union all

    select
      'weekly-review:' || p_week_start::text,
      'weekly_review',
      'Hora de fechar a semana',
      'Revise seus avanços e escolha até três prioridades para a próxima semana.',
      '/revisao-semanal',
      2::smallint,
      (p_week_start + 6)
    from settings
    where settings.weekly_review_reminders
      and extract(isodow from p_local_date)::smallint >= settings.weekly_review_day
      and not exists (
        select 1 from public.weekly_reviews review
        where review.workspace_id = p_workspace_id
          and review.user_id = auth.uid()
          and review.week_start = p_week_start
      )
  )
  select candidate.*
  from candidates candidate
  where public.is_workspace_member(p_workspace_id)
    and not exists (
      select 1 from public.notification_dismissals dismissal
      where dismissal.workspace_id = p_workspace_id
        and dismissal.user_id = auth.uid()
        and dismissal.reminder_key = candidate.reminder_key
        and dismissal.dismissed_until > now()
    )
  order by candidate.priority desc, candidate.due_date nulls last, candidate.title
  limit 20;
$$;

revoke all on function public.get_personal_reminders(uuid, date, time, date) from public;
revoke all on function public.get_personal_reminders(uuid, date, time, date) from anon;
grant execute on function public.get_personal_reminders(uuid, date, time, date) to authenticated;
