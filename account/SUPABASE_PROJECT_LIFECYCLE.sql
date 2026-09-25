-- HeartSpace: ciclo de vida administrativo dos projetos.
-- Execute depois de SUPABASE_PROJECT_ROLE_SYSTEM.sql e antes de publicar a Function.

alter table public.projects
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz;

update public.projects
  set status = 'active'
  where status is null or status not in ('active', 'archived');

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check check (status in ('active', 'archived'));

create index if not exists projects_studio_status_idx
  on public.projects (studio_id, status, created_at desc);

comment on column public.projects.status is
  'Estado administrativo do projeto. Arquivados continuam preservados e podem ser restaurados.';
