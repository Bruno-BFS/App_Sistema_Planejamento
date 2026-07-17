-- Keep account deletion consistent across personal workspaces and user-owned activity.
alter table public.workspaces
  drop constraint workspaces_owner_id_fkey,
  add constraint workspaces_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete cascade;

alter table public.focus_sessions
  drop constraint focus_sessions_user_id_fkey,
  add constraint focus_sessions_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.daily_reviews
  drop constraint daily_reviews_user_id_fkey,
  add constraint daily_reviews_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;
