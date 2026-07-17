create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  biggest_win text,
  main_challenge text,
  key_learning text,
  stop_doing text,
  start_doing text,
  continue_doing text,
  next_week_priorities jsonb not null default '[]'::jsonb,
  weekly_intention text,
  confidence_score smallint not null default 3 check (confidence_score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reviews_week_start_monday check (extract(isodow from week_start) = 1),
  constraint weekly_reviews_priorities_array check (jsonb_typeof(next_week_priorities) = 'array'),
  constraint weekly_reviews_unique_week unique (workspace_id, user_id, week_start)
);

create index weekly_reviews_user_week_idx
  on public.weekly_reviews (user_id, week_start desc);

create trigger weekly_reviews_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

alter table public.weekly_reviews enable row level security;

create policy "weekly_reviews_owner_access"
  on public.weekly_reviews
  for all
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.weekly_reviews to authenticated;
