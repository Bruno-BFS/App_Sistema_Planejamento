alter table public.profiles
  add column app_theme text not null default 'olive',
  add constraint profiles_app_theme_check
    check (app_theme in ('olive', 'rose', 'charcoal', 'blue'));

comment on column public.profiles.app_theme is
  'Paleta visual escolhida pelo usuário para o aplicativo.';
