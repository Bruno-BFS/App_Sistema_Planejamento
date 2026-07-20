alter table public.profiles
  add column if not exists app_theme text not null default 'olive';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_app_theme_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_app_theme_check
        check (app_theme in ('olive', 'rose', 'charcoal', 'blue'));
  end if;
end
$$;

comment on column public.profiles.app_theme is
  'Paleta visual escolhida pelo usuário para o aplicativo.';
