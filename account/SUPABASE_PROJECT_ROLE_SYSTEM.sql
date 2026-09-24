-- HeartSpace: modelos de estúdio e papéis múltiplos por projeto.
-- Execute depois de SUPABASE_PROJECT_IMAGES.sql.
-- Esta estrutura usa somente studios, projects e project_members.

alter table public.studios
  add column if not exists role_template_key text not null default 'blank';

alter table public.projects
  add column if not exists role_permissions jsonb not null default '{}'::jsonb,
  add column if not exists role_colors jsonb not null default '{}'::jsonb;

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Papel primário para clientes antigos; o acesso real vem de roles.
  role text not null default 'reader',
  roles jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, user_id),
  constraint project_members_roles_array check (jsonb_typeof(roles) = 'array')
);

create index if not exists project_members_user_project_idx
  on public.project_members (user_id, project_id);

alter table public.project_members enable row level security;

drop policy if exists "project_members_read_own_or_owned_project" on public.project_members;
create policy "project_members_read_own_or_owned_project"
  on public.project_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.projects where projects.id = project_members.project_id and projects.owner_id = auth.uid())
  );

drop policy if exists "project_members_owner_manage" on public.project_members;
create policy "project_members_owner_manage"
  on public.project_members for all to authenticated
  using (exists (select 1 from public.projects where projects.id = project_members.project_id and projects.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects where projects.id = project_members.project_id and projects.owner_id = auth.uid()));

comment on column public.studios.role_template_key is
  'Modelo inicial de cargos aplicado aos novos projetos do estúdio.';
comment on column public.project_members.roles is
  'Papéis de produção acumulativos, válidos somente no projeto.';
