-- Preserve shared records when their original creator deletes the account.
alter table public.goals
  alter column created_by drop not null,
  drop constraint goals_created_by_fkey,
  add constraint goals_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.projects
  alter column created_by drop not null,
  drop constraint projects_created_by_fkey,
  add constraint projects_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.tasks
  alter column created_by drop not null,
  drop constraint tasks_created_by_fkey,
  add constraint tasks_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;
