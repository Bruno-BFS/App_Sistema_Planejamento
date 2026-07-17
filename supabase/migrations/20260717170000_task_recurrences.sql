create table public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  goal_id uuid,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  priority public.task_priority not null default 'medium',
  estimated_minutes integer not null default 30 check (estimated_minutes between 0 and 10080),
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_count smallint not null default 1 check (interval_count between 1 and 12),
  start_date date not null,
  end_date date,
  next_occurrence date not null,
  last_generated_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint recurrence_date_order check (end_date is null or end_date >= start_date),
  constraint recurrence_project_workspace_fk foreign key (project_id, workspace_id)
    references public.projects(id, workspace_id) on delete set null (project_id),
  constraint recurrence_goal_workspace_fk foreign key (goal_id, workspace_id)
    references public.goals(id, workspace_id) on delete set null (goal_id)
);

alter table public.tasks
  add column recurrence_id uuid,
  add column occurrence_date date,
  add constraint tasks_recurrence_workspace_fk foreign key (recurrence_id, workspace_id)
    references public.task_recurrences(id, workspace_id) on delete set null (recurrence_id),
  add constraint tasks_occurrence_pair check (
    recurrence_id is null or occurrence_date is not null
  );

create unique index tasks_recurrence_occurrence_idx
  on public.tasks (recurrence_id, occurrence_date);
create index task_recurrences_due_idx
  on public.task_recurrences (workspace_id, created_by, next_occurrence)
  where is_active;

create trigger task_recurrences_updated_at
  before update on public.task_recurrences
  for each row execute function public.set_updated_at();

alter table public.task_recurrences enable row level security;

create policy "task_recurrences_owner_access"
  on public.task_recurrences
  for all
  using (created_by = auth.uid() and public.is_workspace_member(workspace_id))
  with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.task_recurrences to authenticated;

create or replace function public.advance_recurrence_date(
  p_date date,
  p_frequency text,
  p_interval integer,
  p_anchor_date date
)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  target_month date;
  last_day date;
begin
  if p_interval < 1 or p_interval > 12 then
    raise exception 'Intervalo de recorrência inválido';
  end if;

  if p_frequency = 'daily' then
    return p_date + p_interval;
  elsif p_frequency = 'weekly' then
    return p_date + (7 * p_interval);
  elsif p_frequency = 'monthly' then
    target_month := (date_trunc('month', p_date) + make_interval(months => p_interval))::date;
    last_day := (target_month + interval '1 month - 1 day')::date;
    return make_date(
      extract(year from target_month)::integer,
      extract(month from target_month)::integer,
      least(extract(day from p_anchor_date)::integer, extract(day from last_day)::integer)
    );
  end if;

  raise exception 'Frequência de recorrência inválida';
end;
$$;

create or replace function public.generate_due_recurring_tasks(
  p_workspace_id uuid,
  p_through_date date
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  recurrence_row public.task_recurrences%rowtype;
  occurrence date;
  last_processed date;
  generated_count integer := 0;
  processed_count integer;
  inserted_count integer;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Acesso negado ao workspace';
  end if;
  if p_through_date > current_date + 7 then
    raise exception 'Data de geração muito distante';
  end if;

  for recurrence_row in
    select * from public.task_recurrences
    where workspace_id = p_workspace_id
      and created_by = auth.uid()
      and is_active
      and next_occurrence <= p_through_date
    order by next_occurrence
    for update
  loop
    occurrence := recurrence_row.next_occurrence;
    last_processed := recurrence_row.last_generated_date;
    processed_count := 0;

    while occurrence <= p_through_date
      and (recurrence_row.end_date is null or occurrence <= recurrence_row.end_date)
      and processed_count < 366
    loop
      insert into public.tasks (
        workspace_id, project_id, goal_id, title, description, status, priority,
        planned_date, estimated_minutes, created_by, recurrence_id, occurrence_date
      ) values (
        recurrence_row.workspace_id, recurrence_row.project_id, recurrence_row.goal_id,
        recurrence_row.title, recurrence_row.description, 'planned', recurrence_row.priority,
        occurrence, recurrence_row.estimated_minutes, auth.uid(), recurrence_row.id, occurrence
      ) on conflict (recurrence_id, occurrence_date) do nothing;

      get diagnostics inserted_count = row_count;
      generated_count := generated_count + inserted_count;
      last_processed := occurrence;
      occurrence := public.advance_recurrence_date(
        occurrence, recurrence_row.frequency, recurrence_row.interval_count, recurrence_row.start_date
      );
      processed_count := processed_count + 1;
    end loop;

    update public.task_recurrences
    set next_occurrence = occurrence,
        last_generated_date = last_processed,
        is_active = case
          when end_date is not null and occurrence > end_date then false
          else is_active
        end
    where id = recurrence_row.id;
  end loop;

  return generated_count;
end;
$$;

create or replace function public.set_task_recurrence_active(
  p_recurrence_id uuid,
  p_is_active boolean,
  p_today date
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  recurrence_row public.task_recurrences%rowtype;
  next_date date;
  guard_count integer := 0;
begin
  select * into recurrence_row
  from public.task_recurrences
  where id = p_recurrence_id and created_by = auth.uid()
  for update;

  if not found then raise exception 'Rotina não encontrada'; end if;

  next_date := recurrence_row.next_occurrence;
  if p_is_active then
    while next_date < p_today and guard_count < 366 loop
      next_date := public.advance_recurrence_date(
        next_date, recurrence_row.frequency, recurrence_row.interval_count, recurrence_row.start_date
      );
      guard_count := guard_count + 1;
    end loop;
  end if;

  update public.task_recurrences
  set is_active = p_is_active,
      next_occurrence = next_date
  where id = p_recurrence_id;
end;
$$;

revoke all on function public.advance_recurrence_date(date, text, integer, date) from public;
revoke all on function public.advance_recurrence_date(date, text, integer, date) from anon;
revoke all on function public.generate_due_recurring_tasks(uuid, date) from public;
revoke all on function public.generate_due_recurring_tasks(uuid, date) from anon;
revoke all on function public.set_task_recurrence_active(uuid, boolean, date) from public;
revoke all on function public.set_task_recurrence_active(uuid, boolean, date) from anon;

grant execute on function public.generate_due_recurring_tasks(uuid, date) to authenticated;
grant execute on function public.set_task_recurrence_active(uuid, boolean, date) to authenticated;
grant execute on function public.advance_recurrence_date(date, text, integer, date) to authenticated;
