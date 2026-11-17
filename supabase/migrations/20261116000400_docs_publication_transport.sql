-- Fatia 5C: distribuição pública derivada da fonte aprovada.
-- Não aplicar isoladamente: ver docs/MIGRATION_ROLLOUT.md.
-- Bucket privado, sem políticas para anon/authenticated. Somente a Function
-- verifica a página atualmente publicada antes de entregar cada imagem.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('docs-publications','docs-publications',false,4194304,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table public.docs_publication_media(
  source_revision_id uuid not null references public.doc_revisions(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  path text not null unique,
  mime text not null check(mime in ('image/png','image/jpeg','image/webp')),
  bytes integer not null check(bytes between 1 and 4194304),
  created_at timestamptz not null default now(),
  primary key(source_revision_id,sha256)
);
create table public.docs_publication_receipts(
  actor_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,operation_id)
);
alter table public.docs_publication_media enable row level security;
alter table public.docs_publication_receipts enable row level security;
revoke all on public.docs_publication_media,public.docs_publication_receipts from public,anon,authenticated;
grant select,insert on public.docs_publication_media,public.docs_publication_receipts to service_role;

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
        snapshot_version = case when p_has_snapshot then (p_snapshot_json->>'version')::integer else snapshot_version end,
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
      case when p_has_snapshot then (p_snapshot_json->>'version')::integer end,
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
      p_source_revision_number, p_snapshot_json, (p_snapshot_json->>'version')::integer, p_approved_by,
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

-- O chamador é exclusivamente o servidor. O ator é rechecado dentro da
-- transação; não basta confiar no payload ou no resultado anterior da Function.
create or replace function public.heartspace_publish_docs_revision_v1(
 p_actor_id uuid,p_operation_id uuid,p_request_hash text,p_project_id uuid,p_studio_id uuid,
 p_publication_id uuid,p_expected_revision_id uuid,p_expected_updated_at timestamptz,
 p_source_revision_id uuid,p_content_hash text,p_snapshot jsonb,
 p_title text,p_slug text,p_summary text,p_source_url text,p_visibility text
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
 project_row public.projects%rowtype; membership_role text; member_roles text[];
 revision_row public.doc_revisions%rowtype; publication_row public.project_publications%rowtype;
 receipt public.docs_publication_receipts%rowtype; saved record; result jsonb; allowed boolean; image jsonb;
begin
 select * into project_row from public.projects p where p.id=p_project_id and p.studio_id=p_studio_id for share;
 if not found then raise exception 'Projeto indisponível.' using errcode='42501'; end if;
 select sm.role into membership_role from public.studio_members sm where sm.studio_id=p_studio_id and sm.user_id=p_actor_id for share;
 if membership_role is null then raise exception 'Acesso revogado.' using errcode='42501'; end if;
 allowed := project_row.owner_id=p_actor_id or membership_role in ('owner','admin');
 if not allowed then
   select case when jsonb_array_length(pm.roles)>0 then array(select jsonb_array_elements_text(pm.roles)) else array[pm.role] end into member_roles
   from public.project_members pm where pm.project_id=p_project_id and pm.user_id=p_actor_id for share;
   select exists(select 1 from unnest(member_roles) as roles(role_key) where
     project_row.role_permissions->roles.role_key->>'manage_publications'='true' or project_row.role_permissions->roles.role_key->>'manage_workspace'='true') into allowed;
 end if;
 perform 1 from public.project_apps a where a.project_id=p_project_id and a.app_key='docs' for share;
 if allowed is not true or exists(select 1 from public.project_apps a where a.project_id=p_project_id and a.app_key='docs' and not a.enabled) then
   raise exception 'Você não pode publicar neste projeto.' using errcode='42501';
 end if;
 if p_operation_id is null or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then raise exception 'Pedido inválido.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_operation_id::text,0));
 select * into receipt from public.docs_publication_receipts r where r.actor_id=p_actor_id and r.operation_id=p_operation_id;
 if found then
   if receipt.project_id<>p_project_id or receipt.request_hash<>p_request_hash then raise exception 'Pedido já usado com outro conteúdo.' using errcode='P0001'; end if;
   return receipt.result;
 end if;
 select r.* into revision_row from public.doc_revisions r join public.docs d on d.id=r.doc_id
 where r.id=p_source_revision_id and d.project_id=p_project_id for share of r,d;
 if not found or revision_row.approved_at is null or revision_row.content_hash is distinct from p_content_hash then
   raise exception 'A revisão não está aprovada para este projeto.' using errcode='P0001';
 end if;
 if (p_snapshot->>'format') is distinct from 'heartspace-docs-publication-v2' or (p_snapshot->>'version') is distinct from '2'
    or jsonb_typeof(p_snapshot->'assets') is distinct from 'array' or jsonb_typeof(p_snapshot->'blocks') is distinct from 'array' then
   raise exception 'Snapshot inválido.';
 end if;
 for image in select value from jsonb_array_elements(p_snapshot->'assets') loop
   if not exists(select 1 from public.docs_publication_media m where m.source_revision_id=p_source_revision_id
      and m.project_id=p_project_id and m.sha256=image->>'id' and m.mime=image->>'mime' and m.bytes=(image->>'bytes')::integer) then
     raise exception 'Imagem não preparada para esta revisão.' using errcode='P0001';
   end if;
 end loop;
 if p_publication_id is not null then
   select * into publication_row from public.project_publications p where p.id=p_publication_id and p.project_id=p_project_id and p.studio_id=p_studio_id for update;
   if not found then raise exception 'Página não encontrada.' using errcode='P0001'; end if;
   if publication_row.current_revision_id is distinct from p_expected_revision_id or publication_row.updated_at is distinct from p_expected_updated_at then
     raise exception 'A página foi alterada por outra pessoa. Atualize antes de publicar.' using errcode='40001';
   end if;
 end if;
 select * into saved from public.heartspace_save_project_publication(
   p_publication_id,p_studio_id,p_project_id,p_title,p_slug,p_summary,p_source_url,p_visibility,'published',true,
   revision_row.doc_id,revision_row.id,revision_row.revision_number,p_snapshot,revision_row.approved_by,revision_row.approved_at,p_actor_id);
 result:=jsonb_build_object('id',saved.publication_id,'status',saved.status,'updated_at',saved.updated_at,'published_at',saved.published_at,'snapshot_version',saved.snapshot_version);
 insert into public.docs_publication_receipts(actor_id,operation_id,project_id,request_hash,result)
 values(p_actor_id,p_operation_id,p_project_id,p_request_hash,result);
 insert into public.studio_audit_log(studio_id,actor_id,action,target_type,target_id)
 values(p_studio_id,p_actor_id,case when p_publication_id is null then 'publication.published' else 'publication.updated' end,'publication',saved.publication_id::text);
 return result;
end; $$;
revoke all on function public.heartspace_publish_docs_revision_v1(uuid,uuid,text,uuid,uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.heartspace_publish_docs_revision_v1(uuid,uuid,text,uuid,uuid,uuid,uuid,timestamptz,uuid,text,jsonb,text,text,text,text,text) to service_role;
