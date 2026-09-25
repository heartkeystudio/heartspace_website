-- Docs: gravação condicional, revisões imutáveis e trilha de auditoria.
-- Executar depois de 20260925000100_docs_authorization.sql.

create table if not exists public.doc_revisions (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  revision_number integer not null,
  content jsonb not null,
  content_hash text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_by_name text not null default 'Membro',
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  restored_from_revision_id uuid references public.doc_revisions(id),
  unique (doc_id, revision_number)
);
create index if not exists doc_revisions_doc_created_idx on public.doc_revisions(doc_id, revision_number desc);
alter table public.doc_revisions enable row level security;

create policy doc_revisions_read on public.doc_revisions for select to authenticated
  using (exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_view')));
create policy doc_revisions_insert on public.doc_revisions for insert to authenticated
  with check (exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_edit')));
-- Revisões são snapshots imutáveis. Aprovação passa pela RPC abaixo.
revoke update, delete on public.doc_revisions from authenticated;
grant select, insert on public.doc_revisions to authenticated;

create or replace function public.heartspace_save_doc_content(
  p_doc_id uuid,
  p_content jsonb,
  p_expected_updated_at timestamptz,
  p_author_name text default 'Membro'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_doc public.docs%rowtype;
  next_revision integer;
  updated_doc public.docs%rowtype;
  revision_id uuid;
begin
  select * into current_doc from public.docs where id = p_doc_id;
  if not found then return jsonb_build_object('success', false, 'reason', 'not_found'); end if;
  if not public.heartspace_has_project_capability(current_doc.project_id, 'docs_edit') then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_expected_updated_at is not null and current_doc.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('success', false, 'conflict', true, 'remote_content', current_doc.content, 'remote_updated_at', current_doc.updated_at);
  end if;
  update public.docs set content = p_content, updated_at = now()
  where id = p_doc_id and (p_expected_updated_at is null or updated_at = p_expected_updated_at)
  returning * into updated_doc;
  if not found then
    select * into current_doc from public.docs where id = p_doc_id;
    return jsonb_build_object('success', false, 'conflict', true, 'remote_content', current_doc.content, 'remote_updated_at', current_doc.updated_at);
  end if;
  select coalesce(max(revision_number), 0) + 1 into next_revision from public.doc_revisions where doc_id = p_doc_id;
  insert into public.doc_revisions (doc_id, revision_number, content, content_hash, created_by_name)
  values (p_doc_id, next_revision, p_content, encode(digest(p_content::text, 'sha256'), 'hex'), left(coalesce(p_author_name, 'Membro'), 120))
  returning id into revision_id;
  insert into public.doc_activity (doc_id, actor_name, event_type, details)
  values (p_doc_id, left(coalesce(p_author_name, 'Membro'), 120), 'document.saved', jsonb_build_object('revision_id', revision_id, 'revision_number', next_revision));
  return jsonb_build_object('success', true, 'updated_at', updated_doc.updated_at, 'revision_id', revision_id, 'revision_number', next_revision);
end;
$$;

create or replace function public.heartspace_approve_doc_revision(p_revision_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare revision public.doc_revisions%rowtype; project_id uuid;
begin
  select * into revision from public.doc_revisions where id = p_revision_id;
  if found then
    select project_id into project_id from public.docs where id = revision.doc_id;
  end if;
  if not found or not public.heartspace_has_project_capability(project_id, 'manage_workspace') then return jsonb_build_object('success', false, 'reason', 'forbidden'); end if;
  update public.doc_revisions set approved_by = auth.uid(), approved_at = now() where id = p_revision_id and approved_at is null;
  insert into public.doc_activity (doc_id, event_type, details) values (revision.doc_id, 'revision.approved', jsonb_build_object('revision_id', p_revision_id, 'revision_number', revision.revision_number));
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.heartspace_save_doc_content(uuid, jsonb, timestamptz, text) to authenticated;
grant execute on function public.heartspace_approve_doc_revision(uuid) to authenticated;
