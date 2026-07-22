create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_web_push_dispatcher()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'web_push_cron_secret'
  order by created_at desc
  limit 1;

  if cron_secret is null then
    raise warning 'Vault secret web_push_cron_secret is not configured.';
    return null;
  end if;

  select net.http_post(
    url := 'https://nkrkjvknjwzfvmlhfhxl.supabase.co/functions/v1/dispatch-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_web_push_dispatcher() from public, anon, authenticated;
grant execute on function public.invoke_web_push_dispatcher() to service_role;

select cron.schedule(
  'dispatch-web-push-every-minute',
  '* * * * *',
  'select public.invoke_web_push_dispatcher();'
);
