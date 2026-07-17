alter table public.profiles
  drop constraint if exists profiles_companion_type_check;

alter table public.profiles
  add constraint profiles_companion_type_check
  check (companion_type in ('fox', 'cat', 'robot', 'sprout', 'owl', 'capybara'));
