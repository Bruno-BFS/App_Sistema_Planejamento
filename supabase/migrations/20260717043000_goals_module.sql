create type public.goal_horizon as enum ('short', 'medium', 'long');
create type public.goal_progress_mode as enum ('manual', 'calculated');

alter type public.goal_status add value if not exists 'at_risk';
alter type public.goal_status add value if not exists 'paused';

alter table public.goals
  add column start_date date,
  add column horizon public.goal_horizon not null default 'short',
  add column indicator_name text,
  add column target_value numeric,
  add column current_value numeric not null default 0,
  add column unit text,
  add column progress_mode public.goal_progress_mode not null default 'manual',
  add column priority public.task_priority not null default 'medium',
  add column motivation text,
  add column expected_result text,
  add column next_review_date date,
  add column notes text,
  add constraint goals_date_order check (target_date is null or start_date is null or target_date >= start_date),
  add constraint goals_target_value_positive check (target_value is null or target_value > 0),
  add constraint goals_current_value_non_negative check (current_value >= 0),
  add constraint goals_calculated_progress_values check (
    progress_mode = 'manual' or (target_value is not null and target_value > 0)
  );

create or replace function public.sync_goal_progress()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' then
    new.progress := 100;
  elsif new.progress_mode = 'calculated' then
    new.progress := least(100, greatest(0, round((new.current_value / new.target_value) * 100)))::smallint;
  end if;
  return new;
end;
$$;

create trigger goals_sync_progress
before insert or update of status, progress_mode, progress, current_value, target_value
on public.goals
for each row execute function public.sync_goal_progress();

create index goals_workspace_status_target_idx
  on public.goals (workspace_id, status, target_date);

create or replace function public.get_goal_metrics(p_workspace_id uuid)
returns table (
  goal_id uuid,
  open_tasks bigint,
  completed_tasks bigint,
  projects_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    goal.id as goal_id,
    count(distinct task.id) filter (where task.status not in ('completed', 'cancelled')) as open_tasks,
    count(distinct task.id) filter (where task.status = 'completed') as completed_tasks,
    count(distinct project.id) filter (where project.status <> 'cancelled') as projects_count
  from public.goals goal
  left join public.tasks task on task.goal_id = goal.id and task.workspace_id = goal.workspace_id
  left join public.projects project on project.goal_id = goal.id and project.workspace_id = goal.workspace_id
  where goal.workspace_id = p_workspace_id
  group by goal.id;
$$;

grant execute on function public.get_goal_metrics(uuid) to authenticated;
