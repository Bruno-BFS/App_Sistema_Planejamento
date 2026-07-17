create or replace function public.get_personal_analytics(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  day date,
  planned_tasks bigint,
  completed_tasks bigint,
  planned_minutes bigint,
  focus_minutes bigint,
  mood_score smallint,
  energy_score smallint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with user_settings as (
    select coalesce(profile.timezone, 'America/Sao_Paulo') as timezone
    from public.profiles profile
    where profile.id = auth.uid()
  ), days as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as day
  ), planned as (
    select
      task.planned_date as day,
      count(*) as planned_tasks,
      coalesce(sum(task.estimated_minutes), 0)::bigint as planned_minutes
    from public.tasks task
    where task.workspace_id = p_workspace_id
      and task.created_by = auth.uid()
      and task.status <> 'cancelled'
      and task.planned_date between p_start_date and p_end_date
    group by task.planned_date
  ), completed as (
    select
      timezone((select timezone from user_settings), task.completed_at)::date as day,
      count(*) as completed_tasks
    from public.tasks task
    where task.workspace_id = p_workspace_id
      and task.created_by = auth.uid()
      and task.status = 'completed'
      and task.completed_at is not null
      and timezone((select timezone from user_settings), task.completed_at)::date between p_start_date and p_end_date
    group by timezone((select timezone from user_settings), task.completed_at)::date
  ), focused as (
    select
      timezone((select timezone from user_settings), session.ended_at)::date as day,
      coalesce(sum(session.duration_minutes), 0)::bigint as focus_minutes
    from public.focus_sessions session
    where session.workspace_id = p_workspace_id
      and session.user_id = auth.uid()
      and session.ended_at is not null
      and timezone((select timezone from user_settings), session.ended_at)::date between p_start_date and p_end_date
    group by timezone((select timezone from user_settings), session.ended_at)::date
  )
  select
    days.day,
    coalesce(planned.planned_tasks, 0)::bigint,
    coalesce(completed.completed_tasks, 0)::bigint,
    coalesce(planned.planned_minutes, 0)::bigint,
    coalesce(focused.focus_minutes, 0)::bigint,
    review.mood_score,
    review.energy_score
  from days
  left join planned on planned.day = days.day
  left join completed on completed.day = days.day
  left join focused on focused.day = days.day
  left join public.daily_reviews review
    on review.workspace_id = p_workspace_id
    and review.user_id = auth.uid()
    and review.review_date = days.day
  where p_end_date >= p_start_date
    and p_end_date - p_start_date <= 365
  order by days.day;
$$;

grant execute on function public.get_personal_analytics(uuid, date, date) to authenticated;
