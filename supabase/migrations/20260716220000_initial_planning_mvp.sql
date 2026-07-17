create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.task_status as enum ('backlog', 'planned', 'in_progress', 'completed', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'critical');
create type public.project_status as enum ('planned', 'active', 'paused', 'completed', 'cancelled');
create type public.goal_status as enum ('planned', 'active', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 100),
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  description text,
  status public.goal_status not null default 'planned',
  target_date date,
  progress smallint not null default 0 check (progress between 0 and 100),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_id uuid,
  title text not null check (char_length(title) between 1 and 180),
  description text,
  status public.project_status not null default 'planned',
  start_date date,
  target_date date,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint project_goal_workspace_fk foreign key (goal_id, workspace_id)
    references public.goals(id, workspace_id) on delete set null (goal_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  goal_id uuid,
  parent_task_id uuid,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  status public.task_status not null default 'backlog',
  priority public.task_priority not null default 'medium',
  planned_date date,
  due_at timestamptz,
  estimated_minutes integer not null default 30 check (estimated_minutes between 0 and 10080),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  position integer not null default 0,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint task_project_workspace_fk foreign key (project_id, workspace_id)
    references public.projects(id, workspace_id) on delete set null (project_id),
  constraint task_goal_workspace_fk foreign key (goal_id, workspace_id)
    references public.goals(id, workspace_id) on delete set null (goal_id),
  constraint task_parent_workspace_fk foreign key (parent_task_id, workspace_id)
    references public.tasks(id, workspace_id) on delete set null (parent_task_id)
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null,
  user_id uuid not null default auth.uid() references public.profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  focus_score smallint check (focus_score between 1 and 5),
  energy_score smallint check (energy_score between 1 and 5),
  interruptions integer not null default 0 check (interruptions >= 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint focus_session_order check (ended_at is null or ended_at >= started_at),
  constraint focus_task_workspace_fk foreign key (task_id, workspace_id)
    references public.tasks(id, workspace_id) on delete restrict
);

create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id),
  review_date date not null default current_date,
  wins text,
  challenges text,
  learnings text,
  tomorrow_intention text,
  mood_score smallint check (mood_score between 1 and 5),
  energy_score smallint check (energy_score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, review_date)
);

create index tasks_workspace_date_idx on public.tasks (workspace_id, planned_date, status);
create index tasks_project_idx on public.tasks (project_id) where project_id is not null;
create index focus_sessions_workspace_started_idx on public.focus_sessions (workspace_id, started_at desc);
create unique index focus_sessions_one_active_per_user_idx on public.focus_sessions (user_id) where ended_at is null;
create index reviews_workspace_date_idx on public.daily_reviews (workspace_id, review_date desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger goals_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger daily_reviews_updated_at before update on public.daily_reviews for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(p_workspace_id uuid, p_roles public.workspace_role[])
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid() and role = any(p_roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  new_workspace_id uuid := gen_random_uuid();
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));

  insert into public.workspaces (id, owner_id, name, slug)
  values (new_workspace_id, new.id, 'Meu espaço', 'personal-' || new.id::text);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.start_focus_session(p_workspace_id uuid, p_task_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  new_session_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Acesso negado ao workspace';
  end if;
  if not exists (select 1 from public.tasks where id = p_task_id and workspace_id = p_workspace_id) then
    raise exception 'Tarefa inválida';
  end if;
  if exists (select 1 from public.focus_sessions where user_id = auth.uid() and ended_at is null) then
    raise exception 'Já existe uma sessão de foco ativa';
  end if;

  insert into public.focus_sessions (workspace_id, task_id, user_id)
  values (p_workspace_id, p_task_id, auth.uid()) returning id into new_session_id;
  update public.tasks set status = 'in_progress' where id = p_task_id and status <> 'completed';
  return new_session_id;
end;
$$;

create or replace function public.stop_focus_session(p_session_id uuid)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  session_row public.focus_sessions%rowtype;
  elapsed_minutes integer;
begin
  select * into session_row from public.focus_sessions
  where id = p_session_id and user_id = auth.uid() and ended_at is null for update;
  if not found then raise exception 'Sessão ativa não encontrada'; end if;

  elapsed_minutes := greatest(1, floor(extract(epoch from (now() - session_row.started_at)) / 60)::integer);
  update public.focus_sessions set ended_at = now(), duration_minutes = elapsed_minutes where id = p_session_id;
  update public.tasks set actual_minutes = actual_minutes + elapsed_minutes where id = session_row.task_id;
  return elapsed_minutes;
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.goals enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.daily_reviews enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "workspaces_select_member" on public.workspaces for select using (public.is_workspace_member(id));
create policy "workspaces_update_admin" on public.workspaces for update using (public.has_workspace_role(id, array['owner','admin']::public.workspace_role[]));
create policy "members_select_member" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
create policy "members_manage_owner" on public.workspace_members for all
  using (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]))
  with check (public.has_workspace_role(workspace_id, array['owner']::public.workspace_role[]));

create policy "goals_member_access" on public.goals for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "projects_member_access" on public.projects for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "tasks_member_access" on public.tasks for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "focus_member_select" on public.focus_sessions for select using (public.is_workspace_member(workspace_id));
create policy "focus_owner_write" on public.focus_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "reviews_owner_access" on public.daily_reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role[]) to authenticated;
grant execute on function public.start_focus_session(uuid, uuid) to authenticated;
grant execute on function public.stop_focus_session(uuid) to authenticated;

insert into public.profiles (id, name)
select id, coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1))
from auth.users on conflict (id) do nothing;

insert into public.workspaces (owner_id, name, slug)
select id, 'Meu espaço', 'personal-' || id::text from auth.users
on conflict (slug) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select workspaces.id, workspaces.owner_id, 'owner'
from public.workspaces where workspaces.slug = 'personal-' || workspaces.owner_id::text
on conflict (workspace_id, user_id) do nothing;
