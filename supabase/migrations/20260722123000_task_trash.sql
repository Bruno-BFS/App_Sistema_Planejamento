alter table public.tasks
  add column deleted_at timestamptz,
  add column deleted_previous_status public.task_status,
  add constraint tasks_trash_state_consistent check (
    (deleted_at is null and deleted_previous_status is null)
    or (deleted_at is not null and deleted_previous_status is not null)
  );

create index tasks_workspace_deleted_at_idx
  on public.tasks (workspace_id, deleted_at desc)
  where deleted_at is not null;

alter table public.focus_sessions
  drop constraint focus_task_workspace_fk,
  add constraint focus_task_workspace_fk foreign key (task_id, workspace_id)
    references public.tasks(id, workspace_id) on delete cascade;

create or replace function public.archive_task(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.tasks
  set
    deleted_previous_status = status,
    status = 'cancelled',
    deleted_at = now()
  where id = p_task_id
    and deleted_at is null;

  if not found then
    raise exception 'Tarefa não encontrada ou já está na lixeira.';
  end if;
end;
$$;

create or replace function public.restore_task(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.tasks
  set
    status = deleted_previous_status,
    deleted_at = null,
    deleted_previous_status = null
  where id = p_task_id
    and deleted_at is not null;

  if not found then
    raise exception 'Tarefa não encontrada na lixeira.';
  end if;
end;
$$;

create or replace function public.purge_task(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.tasks
  where id = p_task_id
    and deleted_at is not null;

  if not found then
    raise exception 'Tarefa não encontrada na lixeira.';
  end if;
end;
$$;

revoke all on function public.archive_task(uuid) from public, anon;
revoke all on function public.restore_task(uuid) from public, anon;
revoke all on function public.purge_task(uuid) from public, anon;
grant execute on function public.archive_task(uuid) to authenticated;
grant execute on function public.restore_task(uuid) to authenticated;
grant execute on function public.purge_task(uuid) to authenticated;
