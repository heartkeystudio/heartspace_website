create or replace function public.heartspace_restore_doc_revision(
  p_revision_id uuid,
  p_expected_updated_at timestamptz,
  p_author_name text default 'Membro'
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  source_revision public.doc_revisions%rowtype;
  current_doc public.docs%rowtype;
  updated_doc public.docs%rowtype;
  next_revision integer;
  new_revision_id uuid;
begin
  select * into source_revision from public.doc_revisions where id = p_revision_id;
  if not found then return jsonb_build_object('success', false, 'reason', 'revision_not_found'); end if;

  select * into current_doc from public.docs where id = source_revision.doc_id for update;
  if not found then return jsonb_build_object('success', false, 'reason', 'document_not_found'); end if;
  if not public.heartspace_has_project_capability(current_doc.project_id, 'docs_edit') then
    return jsonb_build_object('success', false, 'reason', 'forbidden');
  end if;
  if p_expected_updated_at is not null and current_doc.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('success', false, 'conflict', true, 'remote_updated_at', current_doc.updated_at);
  end if;

  update public.docs
  set content = source_revision.content,
      title = coalesce(nullif(source_revision.content ->> 'title', ''), current_doc.title),
      updated_at = now()
  where id = current_doc.id
  returning * into updated_doc;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.doc_revisions where doc_id = current_doc.id;
  insert into public.doc_revisions (doc_id, revision_number, content, content_hash, created_by_name, restored_from_revision_id)
  values (current_doc.id, next_revision, source_revision.content, encode(digest(source_revision.content::text, 'sha256'), 'hex'), left(coalesce(p_author_name, 'Membro'), 120), source_revision.id)
  returning id into new_revision_id;
  insert into public.doc_activity (doc_id, actor_name, event_type, details)
  values (current_doc.id, left(coalesce(p_author_name, 'Membro'), 120), 'document.revision_restored', jsonb_build_object('revision_id', new_revision_id, 'revision_number', next_revision, 'restored_from_revision_id', source_revision.id));

  return jsonb_build_object('success', true, 'updated_at', updated_doc.updated_at, 'revision_id', new_revision_id, 'revision_number', next_revision);
end;
$$;

revoke all on function public.heartspace_restore_doc_revision(uuid, timestamptz, text) from public, anon;
grant execute on function public.heartspace_restore_doc_revision(uuid, timestamptz, text) to authenticated;
