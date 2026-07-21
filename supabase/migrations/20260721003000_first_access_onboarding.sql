do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'onboarding_completed_at'
  ) then
    alter table public.profiles
      add column onboarding_completed_at timestamptz;

    update public.profiles
      set onboarding_completed_at = now();
  end if;
end
$$;

comment on column public.profiles.onboarding_completed_at is
  'Momento em que o usuario concluiu a experiencia inicial do aplicativo.';
