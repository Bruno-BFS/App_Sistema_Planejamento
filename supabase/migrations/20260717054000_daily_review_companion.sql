alter table public.profiles
  add column companion_type text not null default 'fox',
  add constraint profiles_companion_type_check
    check (companion_type in ('fox', 'cat', 'robot', 'sprout'));

create index daily_reviews_user_date_idx
  on public.daily_reviews (user_id, review_date desc);
