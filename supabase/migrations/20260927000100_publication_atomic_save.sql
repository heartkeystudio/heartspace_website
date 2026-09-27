-- Publicações do Docs: grava o registro atual, o snapshot histórico e o
-- ponteiro da revisão em uma única transação.

create or replace function public.heartspace_save_project_publication(
  p_publication_id uuid,
  p_studio_id uuid,
  p_project_id uuid,
  p_title text,
  p_slug text,
  p_summary text,
  p_source_url text,
  p_visibility text,
  p_status text,
  p_has_snapshot boolean,
  p_source_document_id uuid,
  p_source_revision_id uuid,
  p_source_revision_number integer,
  p_snapshot_json jsonb,
  p_approved_by uuid,
  p_approved_at timestamptz,
  p_published_by uuid
)
returns table (
  publication_id uuid,
  status text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  snapshot_version integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  publication_row public.project_publications%rowtype;
  next_revision_number integer;
  published_revision_id uuid;
begin
  if p_publication_id is null and p_status = 'published' and not p_has_snapshot then
    raise exception 'Uma publicação nova precisa de uma revisão aprovada.' using errcode = 'P0001';
  end if;

  if p_publication_id is not null then
    select * into publication_row
    from public.project_publications
    where id = p_publication_id and studio_id = p_studio_id and project_id = p_project_id
    for update;

    if not found then
      raise exception 'Publicação não encontrada neste projeto.' using errcode = 'P0002';
    end if;

    if publication_row.status = 'withdrawn' and p_status = 'published' and not p_has_snapshot then
      raise exception 'Para republicar, publique uma nova revisão aprovada.' using errcode = 'P0001';
    end if;
    if p_status = 'published' and not p_has_snapshot and publication_row.snapshot_json is null then
      raise exception 'Uma publicação precisa de uma revisão aprovada.' using errcode = 'P0001';
    end if;

    update public.project_publications
    set title = p_title,
        slug = p_slug,
        summary = nullif(p_summary, ''),
        source_url = nullif(p_source_url, ''),
        visibility = p_visibility,
        status = p_status,
        published_at = case when p_status <> 'published' then null when p_has_snapshot then timezone('utc', now()) else publication_row.published_at end,
        updated_at = timezone('utc', now()),
        source_document_id = case when p_has_snapshot then p_source_document_id else source_document_id end,
        source_revision_id = case when p_has_snapshot then p_source_revision_id else source_revision_id end,
        source_revision_number = case when p_has_snapshot then p_source_revision_number else source_revision_number end,
        snapshot_json = case when p_has_snapshot then p_snapshot_json else snapshot_json end,
        snapshot_version = case when p_has_snapshot then 1 else snapshot_version end,
        approved_by = case when p_has_snapshot then p_approved_by else approved_by end,
        approved_at = case when p_has_snapshot then p_approved_at else approved_at end
    where id = publication_row.id
    returning * into publication_row;
  else
    insert into public.project_publications (
      studio_id, project_id, title, slug, summary, source_url, visibility, status,
      published_at, source_document_id, source_revision_id, source_revision_number,
      snapshot_json, snapshot_version, approved_by, approved_at
    ) values (
      p_studio_id, p_project_id, p_title, p_slug, nullif(p_summary, ''), nullif(p_source_url, ''), p_visibility, p_status,
      case when p_status = 'published' then timezone('utc', now()) else null end,
      case when p_has_snapshot then p_source_document_id end,
      case when p_has_snapshot then p_source_revision_id end,
      case when p_has_snapshot then p_source_revision_number end,
      case when p_has_snapshot then p_snapshot_json end,
      case when p_has_snapshot then 1 end,
      case when p_has_snapshot then p_approved_by end,
      case when p_has_snapshot then p_approved_at end
    ) returning * into publication_row;
  end if;

  if p_has_snapshot then
    if exists (
      select 1 from public.project_publication_revisions
      where publication_id = publication_row.id and source_revision_id = p_source_revision_id
    ) then
      raise exception 'Esta revisão já foi publicada nesta página.' using errcode = 'P0001';
    end if;

    select coalesce(max(revision_number), 0) + 1 into next_revision_number
    from public.project_publication_revisions
    where publication_id = publication_row.id;

    insert into public.project_publication_revisions (
      publication_id, revision_number, source_document_id, source_revision_id,
      source_revision_number, snapshot_json, snapshot_version, approved_by,
      approved_at, published_by
    ) values (
      publication_row.id, next_revision_number, p_source_document_id, p_source_revision_id,
      p_source_revision_number, p_snapshot_json, 1, p_approved_by,
      p_approved_at, p_published_by
    ) returning id into published_revision_id;

    update public.project_publications
    set current_revision_id = published_revision_id
    where id = publication_row.id
    returning * into publication_row;
  end if;

  return query select publication_row.id, publication_row.status, publication_row.published_at,
    publication_row.created_at, publication_row.updated_at, publication_row.snapshot_version;
end;
$$;

revoke all on function public.heartspace_save_project_publication(
  uuid, uuid, uuid, text, text, text, text, text, text, boolean, uuid, uuid,
  integer, jsonb, uuid, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.heartspace_save_project_publication(
  uuid, uuid, uuid, text, text, text, text, text, text, boolean, uuid, uuid,
  integer, jsonb, uuid, timestamptz, uuid
) to service_role;
