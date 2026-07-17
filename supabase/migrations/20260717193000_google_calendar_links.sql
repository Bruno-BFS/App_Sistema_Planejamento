create table public.google_calendar_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  calendar_id text not null default 'primary',
  google_event_id text not null,
  html_link text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_links_user_task_key unique (user_id, task_id),
  constraint google_calendar_links_calendar_id_length check (char_length(calendar_id) between 1 and 512),
  constraint google_calendar_links_event_id_length check (char_length(google_event_id) between 1 and 1024)
);

create index google_calendar_links_workspace_user_idx
  on public.google_calendar_links (workspace_id, user_id, synced_at desc);

create trigger google_calendar_links_updated_at
  before update on public.google_calendar_links
  for each row execute function public.set_updated_at();

alter table public.google_calendar_links enable row level security;

create policy "Users can read their Google Calendar links"
  on public.google_calendar_links for select
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "Users can remove their Google Calendar links"
  on public.google_calendar_links for delete
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

revoke all on table public.google_calendar_links from anon;
revoke insert, update on table public.google_calendar_links from authenticated;
grant select, delete on table public.google_calendar_links to authenticated;

comment on table public.google_calendar_links is
  'Idempotency links between personal tasks and Google Calendar events. OAuth tokens are never stored here.';
