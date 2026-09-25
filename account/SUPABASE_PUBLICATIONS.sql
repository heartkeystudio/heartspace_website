-- HeartSpace: publicações administradas pelo site.
-- Execute depois de SUPABASE_PROJECT_LIFECYCLE.sql.

create table if not exists public.project_publications (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  summary text,
  source_url text,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted')),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, slug)
);

create index if not exists project_publications_project_status_idx
  on public.project_publications (project_id, status, updated_at desc);

alter table public.project_publications enable row level security;

drop policy if exists "project_publications_public_read" on public.project_publications;
create policy "project_publications_public_read" on public.project_publications for select
  using (status = 'published' and visibility in ('public', 'unlisted'));
