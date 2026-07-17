alter type public.project_status add value if not exists 'idea';
alter type public.project_status add value if not exists 'blocked';

alter table public.projects
  add column area text,
  add column priority public.task_priority not null default 'medium',
  add column completed_at timestamptz,
  add column expected_result text,
  add column next_action text,
  add column notes text,
  add column last_activity_at timestamptz not null default now(),
  add constraint projects_date_order check (target_date is null or start_date is null or target_date >= start_date);

update public.projects set last_activity_at = updated_at;

create index projects_workspace_status_target_idx
  on public.projects (workspace_id, status, target_date);

create or replace function public.sync_project_completion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from new.status then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger projects_sync_completion
before insert or update of status on public.projects
for each row execute function public.sync_project_completion();

create or replace function public.touch_project_activity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.project_id is not null then
      update public.projects set last_activity_at = now() where id = new.project_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.project_id is not null then
      update public.projects set last_activity_at = now() where id = new.project_id;
    end if;
    if old.project_id is not null and old.project_id is distinct from new.project_id then
      update public.projects set last_activity_at = now() where id = old.project_id;
    end if;
    return new;
  elsif old.project_id is not null then
    update public.projects set last_activity_at = now() where id = old.project_id;
  end if;
  return old;
end;
$$;

create trigger tasks_touch_project_activity
after insert or update or delete on public.tasks
for each row execute function public.touch_project_activity();

create or replace function public.get_project_metrics(p_workspace_id uuid)
returns table (
  project_id uuid,
  total_tasks bigint,
  open_tasks bigint,
  completed_tasks bigint,
  planned_minutes bigint,
  actual_minutes bigint,
  progress integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    project.id as project_id,
    count(task.id) filter (where task.status <> 'cancelled') as total_tasks,
    count(task.id) filter (where task.status not in ('completed', 'cancelled')) as open_tasks,
    count(task.id) filter (where task.status = 'completed') as completed_tasks,
    coalesce(sum(task.estimated_minutes) filter (where task.status <> 'cancelled'), 0)::bigint as planned_minutes,
    coalesce(sum(task.actual_minutes) filter (where task.status <> 'cancelled'), 0)::bigint as actual_minutes,
    case
      when count(task.id) filter (where task.status <> 'cancelled') = 0 then 0
      else round(
        count(task.id) filter (where task.status = 'completed')::numeric * 100
        / count(task.id) filter (where task.status <> 'cancelled')
      )::integer
    end as progress
  from public.projects project
  left join public.tasks task
    on task.project_id = project.id and task.workspace_id = project.workspace_id
  where project.workspace_id = p_workspace_id
  group by project.id;
$$;

grant execute on function public.get_project_metrics(uuid) to authenticated;
