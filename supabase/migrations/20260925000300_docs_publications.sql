-- Docs -> Hub -> Website: snapshots públicos imutáveis, sempre originados de
-- uma revisão aprovada. Execute depois das migrations Docs 001 e 002.

alter table public.project_publications
  add column if not exists source_document_id uuid references public.docs(id) on delete set null,
  add column if not exists source_revision_id uuid references public.doc_revisions(id) on delete set null,
  add column if not exists source_revision_number integer,
  add column if not exists snapshot_json jsonb,
  add column if not exists snapshot_version integer,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists current_revision_id uuid;

create table if not exists public.project_publication_revisions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.project_publications(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  source_document_id uuid not null references public.docs(id) on delete restrict,
  source_revision_id uuid not null references public.doc_revisions(id) on delete restrict,
  source_revision_number integer not null check (source_revision_number > 0),
  snapshot_json jsonb not null,
  snapshot_version integer not null default 1,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default timezone('utc', now()),
  unique (publication_id, revision_number),
  unique (publication_id, source_revision_id)
);

create index if not exists project_publication_revisions_publication_idx
  on public.project_publication_revisions (publication_id, revision_number desc);

alter table public.project_publication_revisions enable row level security;
revoke all on public.project_publication_revisions from anon, authenticated;

-- A Function usa service_role. Snapshots históricos não recebem UPDATE/DELETE
-- de clientes: republicar sempre cria uma linha nova.
create or replace function public.heartspace_publication_revision_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'project_publication_revisions are immutable';
end;
$$;
drop trigger if exists project_publication_revisions_immutable on public.project_publication_revisions;
create trigger project_publication_revisions_immutable
  before update or delete on public.project_publication_revisions
  for each row execute function public.heartspace_publication_revision_immutable();
