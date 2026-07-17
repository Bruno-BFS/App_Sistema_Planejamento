create or replace function public.dismiss_personal_reminder(
  p_workspace_id uuid,
  p_reminder_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Acesso negado ao workspace';
  end if;
  if char_length(p_reminder_key) < 1 or char_length(p_reminder_key) > 300 then
    raise exception 'Chave de lembrete inválida';
  end if;

  insert into public.notification_dismissals (
    workspace_id, user_id, reminder_key, dismissed_until
  ) values (
    p_workspace_id, auth.uid(), p_reminder_key, now() + interval '24 hours'
  )
  on conflict (workspace_id, user_id, reminder_key)
  do update set dismissed_until = excluded.dismissed_until;
end;
$$;

revoke all on function public.dismiss_personal_reminder(uuid, text) from public;
revoke all on function public.dismiss_personal_reminder(uuid, text) from anon;
grant execute on function public.dismiss_personal_reminder(uuid, text) to authenticated;
