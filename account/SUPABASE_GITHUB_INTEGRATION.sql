-- Fundação da integração GitHub App do HeartSpace.
-- Execute uma vez no SQL Editor do Supabase antes de publicar a Function.

create table if not exists public.studio_github_installations (
    studio_id uuid primary key references public.studios(id) on delete cascade,
    github_installation_id bigint unique,
    account_login text,
    account_type text check (account_type in ('User', 'Organization')),
    installed_by uuid references auth.users(id) on delete set null,
    installed_at timestamptz,
    updated_at timestamptz not null default now()
);

create table if not exists public.project_github_repositories (
    project_id uuid primary key references public.projects(id) on delete cascade,
    studio_id uuid not null references public.studios(id) on delete cascade,
    github_repository_id bigint,
    full_name text not null,
    html_url text not null check (html_url ~ '^https://github\.com/[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$'),
    default_branch text,
    last_event_at timestamptz,
    updated_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.github_oauth_states (
    state text primary key,
    studio_id uuid not null references public.studios(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

create table if not exists public.github_installation_candidates (
    studio_id uuid not null references public.studios(id) on delete cascade,
    github_installation_id bigint not null,
    account_login text not null,
    account_type text,
    authorized_user_id uuid not null references auth.users(id) on delete cascade,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    primary key (studio_id, github_installation_id, authorized_user_id)
);

create table if not exists public.github_webhook_deliveries (
    delivery_id text primary key,
    github_event text not null,
    action text,
    github_installation_id bigint,
    github_repository_id bigint,
    repository_full_name text,
    payload jsonb not null default '{}'::jsonb,
    received_at timestamptz not null default now()
);

create unique index if not exists project_github_repositories_full_name_key on public.project_github_repositories(lower(full_name));
create index if not exists project_github_repositories_studio_id_idx on public.project_github_repositories(studio_id);

alter table public.studio_github_installations enable row level security;
alter table public.project_github_repositories enable row level security;

drop policy if exists studio_github_installations_member_read on public.studio_github_installations;
create policy studio_github_installations_member_read on public.studio_github_installations
for select to authenticated using (
    exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid())
    or exists (select 1 from public.studio_members sm where sm.studio_id = studio_id and sm.user_id = auth.uid())
);

drop policy if exists project_github_repositories_member_read on public.project_github_repositories;
create policy project_github_repositories_member_read on public.project_github_repositories
for select to authenticated using (
    exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid())
    or exists (select 1 from public.studio_members sm where sm.studio_id = studio_id and sm.user_id = auth.uid())
);

-- Inserts/updates são feitos pela Edge Function com a service role após validar
-- Owner/Admin. Não exponha políticas de escrita diretamente ao navegador.
