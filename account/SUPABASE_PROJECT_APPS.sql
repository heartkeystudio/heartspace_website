-- HeartSpace: apps habilitados por projeto.
-- Execute depois de SUPABASE_PROJECT_LIFECYCLE.sql.

create table if not exists public.project_apps (
  project_id uuid not null references public.projects(id) on delete cascade,
  app_key text not null check (app_key in ('docs', 'tasks', 'canvas', 'beats', 'states', 'dialogues', 'polygons', 'designs')),
  enabled boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, app_key)
);

alter table public.project_apps enable row level security;

drop policy if exists "project_apps_read_member" on public.project_apps;
create policy "project_apps_read_member" on public.project_apps for select to authenticated
  using (exists (select 1 from public.project_members where project_members.project_id = project_apps.project_id and project_members.user_id = auth.uid()));
