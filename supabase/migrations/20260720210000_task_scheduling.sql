alter table public.tasks
  add column planned_start_time time without time zone;

alter table public.task_recurrences
  add column planned_start_time time without time zone,
  add column weekdays smallint[] not null default '{}';

alter table public.task_recurrences
  add constraint task_recurrences_weekdays_valid check (
    weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and cardinality(weekdays) <= 7
  );

update public.task_recurrences
set weekdays = array[extract(dow from start_date)::smallint]
where frequency = 'weekly' and cardinality(weekdays) = 0;

alter table public.task_recurrences
  add constraint task_recurrences_weekly_days_required check (
    frequency <> 'weekly' or cardinality(weekdays) > 0
  );

create index tasks_workspace_schedule_idx
  on public.tasks (workspace_id, planned_date, planned_start_time)
  where status <> 'cancelled';

create or replace function public.next_recurrence_date(
  p_date date,
  p_frequency text,
  p_interval integer,
  p_anchor_date date,
  p_weekdays smallint[]
)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  candidate date;
  target_month date;
  last_day date;
  day_offset integer;
  week_offset integer;
begin
  if p_interval < 1 or p_interval > 12 then
    raise exception 'Intervalo de recorrência inválido';
  end if;

  if p_frequency = 'daily' then
    return p_date + p_interval;
  elsif p_frequency = 'weekly' then
    for day_offset in 1..(7 * p_interval + 7) loop
      candidate := p_date + day_offset;
      week_offset := floor((candidate - p_anchor_date)::numeric / 7)::integer;
      if extract(dow from candidate)::smallint = any(p_weekdays)
        and week_offset >= 0
        and mod(week_offset, p_interval) = 0 then
        return candidate;
      end if;
    end loop;
    raise exception 'Não foi possível calcular a próxima ocorrência semanal';
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
        planned_date, planned_start_time, estimated_minutes, created_by, recurrence_id, occurrence_date
      ) values (
        recurrence_row.workspace_id, recurrence_row.project_id, recurrence_row.goal_id,
        recurrence_row.title, recurrence_row.description, 'planned', recurrence_row.priority,
        occurrence, recurrence_row.planned_start_time, recurrence_row.estimated_minutes,
        auth.uid(), recurrence_row.id, occurrence
      ) on conflict (recurrence_id, occurrence_date) do nothing;

      get diagnostics inserted_count = row_count;
      generated_count := generated_count + inserted_count;
      last_processed := occurrence;
      occurrence := public.next_recurrence_date(
        occurrence, recurrence_row.frequency, recurrence_row.interval_count,
        recurrence_row.start_date, recurrence_row.weekdays
      );
      processed_count := processed_count + 1;
    end loop;

    update public.task_recurrences
    set next_occurrence = occurrence,
        last_generated_date = last_processed,
        is_active = case when end_date is not null and occurrence > end_date then false else is_active end
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
      next_date := public.next_recurrence_date(
        next_date, recurrence_row.frequency, recurrence_row.interval_count,
        recurrence_row.start_date, recurrence_row.weekdays
      );
      guard_count := guard_count + 1;
    end loop;
  end if;

  update public.task_recurrences
  set is_active = p_is_active, next_occurrence = next_date
  where id = p_recurrence_id;
end;
$$;

revoke all on function public.next_recurrence_date(date, text, integer, date, smallint[]) from public, anon;
grant execute on function public.next_recurrence_date(date, text, integer, date, smallint[]) to authenticated;
