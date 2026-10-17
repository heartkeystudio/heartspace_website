-- Presença temporária por documento. Os clientes renovam last_seen_at; entradas
-- antigas deixam de aparecer sem depender de evento de fechamento da aba.
create table if not exists public.doc_presence (
  doc_id uuid not null references public.docs(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default 'Membro',
  last_seen_at timestamptz not null default now(),
  primary key (doc_id, user_id)
);
create index if not exists doc_presence_seen_idx on public.doc_presence(doc_id, last_seen_at desc);
alter table public.doc_presence enable row level security;
revoke all on table public.doc_presence from public, anon;
grant select, insert, update, delete on table public.doc_presence to authenticated;

drop policy if exists docs_presence_read on public.doc_presence;
create policy docs_presence_read on public.doc_presence for select to authenticated
  using (exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_view')));
drop policy if exists docs_presence_upsert_self on public.doc_presence;
create policy docs_presence_upsert_self on public.doc_presence for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_view')));
drop policy if exists docs_presence_update_self on public.doc_presence;
create policy docs_presence_update_self on public.doc_presence for update to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_view')))
  with check (user_id = auth.uid() and exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_view')));
drop policy if exists docs_presence_delete_self on public.doc_presence;
create policy docs_presence_delete_self on public.doc_presence for delete to authenticated
  using (user_id = auth.uid());
