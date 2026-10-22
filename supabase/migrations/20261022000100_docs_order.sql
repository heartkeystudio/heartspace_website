-- Store the shared Docs library order separately so reordering does not
-- change a document's updated_at timestamp or create content conflicts.
create table if not exists public.doc_order (
  project_id uuid not null references public.projects(id) on delete cascade,
  doc_id uuid not null references public.docs(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (project_id, doc_id)
);

create index if not exists doc_order_project_sort_idx
  on public.doc_order (project_id, sort_order, doc_id);

alter table public.doc_order enable row level security;
drop policy if exists heartspace_doc_order_read on public.doc_order;
drop policy if exists heartspace_doc_order_insert on public.doc_order;
drop policy if exists heartspace_doc_order_update on public.doc_order;
drop policy if exists heartspace_doc_order_delete on public.doc_order;

create policy heartspace_doc_order_read on public.doc_order for select to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_view'));
create policy heartspace_doc_order_insert on public.doc_order for insert to authenticated
  with check (
    public.heartspace_has_project_capability(project_id, 'docs_edit')
    and exists (select 1 from public.docs d where d.id = doc_id and d.project_id = doc_order.project_id)
  );
create policy heartspace_doc_order_update on public.doc_order for update to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_edit'))
  with check (
    public.heartspace_has_project_capability(project_id, 'docs_edit')
    and exists (select 1 from public.docs d where d.id = doc_id and d.project_id = doc_order.project_id)
  );
create policy heartspace_doc_order_delete on public.doc_order for delete to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_edit'));

grant select, insert, update, delete on public.doc_order to authenticated;
