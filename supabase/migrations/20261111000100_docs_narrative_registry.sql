-- HeartSpace Docs: registro narrativo compartilhado por projeto.
-- Os documentos guardam apenas referências estáveis, como character_id.

create table if not exists public.project_narrative_registry (
  project_id uuid primary key references public.projects(id) on delete cascade,
  characters jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint project_narrative_registry_characters_array
    check (jsonb_typeof(characters) = 'array')
);

alter table public.project_narrative_registry enable row level security;

drop policy if exists heartspace_narrative_registry_read on public.project_narrative_registry;
drop policy if exists heartspace_narrative_registry_insert on public.project_narrative_registry;
drop policy if exists heartspace_narrative_registry_update on public.project_narrative_registry;
drop policy if exists heartspace_narrative_registry_delete on public.project_narrative_registry;

create policy heartspace_narrative_registry_read
  on public.project_narrative_registry for select to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_view'));

create policy heartspace_narrative_registry_insert
  on public.project_narrative_registry for insert to authenticated
  with check (
    updated_by = auth.uid()
    and public.heartspace_has_project_capability(project_id, 'docs_edit')
  );

create policy heartspace_narrative_registry_update
  on public.project_narrative_registry for update to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_edit'))
  with check (
    updated_by = auth.uid()
    and public.heartspace_has_project_capability(project_id, 'docs_edit')
  );

create policy heartspace_narrative_registry_delete
  on public.project_narrative_registry for delete to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_edit'));

grant select, insert, update, delete on public.project_narrative_registry to authenticated;

comment on table public.project_narrative_registry is
  'Registro compartilhado de personagens e futuros recursos narrativos do projeto.';
