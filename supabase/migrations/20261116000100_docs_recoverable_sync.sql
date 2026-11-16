-- Docs slice 4. Deploy together with the v2 Docs client; no unsafe REST fallback.
-- Receipts contain hashes/results, not another copy of authoring media.
begin;

create table if not exists public.docs_sync_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('document','registry')),
  entity_id uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation_id)
);
-- No FK to docs: a lost create acknowledgment must not recreate a deleted doc.
alter table public.docs_sync_receipts enable row level security;
revoke all on public.docs_sync_receipts from public, anon, authenticated;
create index if not exists docs_sync_receipts_project_idx on public.docs_sync_receipts(project_id, created_at);
create index if not exists docs_authoring_identity_lookup on public.docs(project_id,(content #>> '{authoring,document_id}')) where content->>'format' = 'heartspace-html-v1';

alter table public.project_narrative_registry add column if not exists revision bigint not null default 0;

create or replace function public.heartspace_save_doc_v2(
  p_project_id uuid, p_doc_id uuid, p_operation_id uuid,
  p_content jsonb, p_expected_updated_at timestamptz,
  p_author_name text default 'Membro'
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  current_doc public.docs%rowtype;
  updated_doc public.docs%rowtype;
  receipt public.docs_sync_receipts%rowtype;
  was_found boolean;
  request_hash text;
  next_revision integer;
  revision_id uuid;
  response jsonb;
  author_name text := left(coalesce(nullif(p_author_name,''),'Membro'),120);
begin
  if auth.uid() is null or p_project_id is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then
    return jsonb_build_object('success',false,'reason','forbidden');
  end if;
  if p_doc_id is null or p_operation_id is null or jsonb_typeof(p_content) is distinct from 'object'
     or p_content->>'format' is distinct from 'heartspace-html-v1'
     or jsonb_typeof(p_content->'body') is distinct from 'string'
     or jsonb_typeof(p_content->'title') is distinct from 'string' then
    return jsonb_build_object('success',false,'reason','invalid_content');
  end if;
  request_hash := encode(digest(jsonb_build_object('kind','document','project',p_project_id,'id',p_doc_id,'content',p_content,'expected',extract(epoch from p_expected_updated_at))::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_operation_id::text,0));
  if jsonb_typeof(p_content #> '{authoring,document_id}') = 'string' then
    perform pg_advisory_xact_lock(hashtextextended('docs-authoring:' || p_project_id::text || ':' || (p_content #>> '{authoring,document_id}'),0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('docs:' || p_doc_id::text,0));
  select * into current_doc from public.docs d where d.id = p_doc_id for update;
  was_found := found;
  if was_found and current_doc.project_id is distinct from p_project_id then return jsonb_build_object('success',false,'reason','forbidden'); end if;
  select * into receipt from public.docs_sync_receipts r where r.actor_id = auth.uid() and r.operation_id = p_operation_id;
  if found then
    if receipt.request_hash <> request_hash then return jsonb_build_object('success',false,'reason','operation_mismatch'); end if;
    if not was_found then return jsonb_build_object('success',false,'reason','not_found'); end if;
    return receipt.result;
  end if;
  if was_found and (p_expected_updated_at is null or current_doc.updated_at is distinct from p_expected_updated_at) then
    return jsonb_build_object('success',false,'conflict',true,'remote_doc',to_jsonb(current_doc));
  end if;
  if not was_found and p_expected_updated_at is not null then return jsonb_build_object('success',false,'reason','not_found'); end if;

  if not was_found and jsonb_typeof(p_content #> '{authoring,document_id}') = 'string' then
    select * into current_doc from public.docs d where d.project_id = p_project_id and d.content->>'format' = 'heartspace-html-v1'
      and d.content #>> '{authoring,document_id}' = p_content #>> '{authoring,document_id}' limit 1 for update;
    if found then return jsonb_build_object('success',false,'conflict',true,'remote_doc',to_jsonb(current_doc)); end if;
  end if;
  if was_found and (current_doc.content #>> '{authoring,document_id}') is not null
    and (p_content #>> '{authoring,document_id}') is distinct from (current_doc.content #>> '{authoring,document_id}') then
    return jsonb_build_object('success',false,'reason','identity_changed');
  end if;

  if was_found and current_doc.content = p_content and current_doc.title = p_content->>'title' then
    select coalesce(max(r.revision_number),0) into next_revision from public.doc_revisions r where r.doc_id = p_doc_id;
    response := jsonb_build_object('success',true,'doc_id',p_doc_id,'updated_at',current_doc.updated_at,'revision_number',next_revision);
    insert into public.docs_sync_receipts(actor_id,operation_id,project_id,entity_kind,entity_id,request_hash,result)
      values(auth.uid(),p_operation_id,p_project_id,'document',p_doc_id,request_hash,response);
    return response;
  end if;

  if was_found then
    -- Preserve a baseline for old docs which never received an initial revision.
    if not exists (select 1 from public.doc_revisions r where r.doc_id = p_doc_id) then
      insert into public.doc_revisions(doc_id,revision_number,content,content_hash,created_by_name)
      values(p_doc_id,1,coalesce(current_doc.content,'{}'::jsonb) || jsonb_build_object('title',current_doc.title),
        encode(digest((coalesce(current_doc.content,'{}'::jsonb) || jsonb_build_object('title',current_doc.title))::text,'sha256'),'hex'),coalesce(current_doc.author,'Membro'));
    end if;
    update public.docs d set content = p_content, title = p_content->>'title',
      updated_at = greatest(clock_timestamp(),current_doc.updated_at + interval '1 microsecond')
      where d.id = p_doc_id returning * into updated_doc;
  else
    insert into public.docs(id,project_id,type,status,title,author,content)
      values(p_doc_id,p_project_id,'page','draft',p_content->>'title',author_name,p_content) returning * into updated_doc;
  end if;
  select coalesce(max(r.revision_number),0)+1 into next_revision from public.doc_revisions r where r.doc_id = p_doc_id;
  insert into public.doc_revisions(doc_id,revision_number,content,content_hash,created_by_name)
    values(p_doc_id,next_revision,p_content,encode(digest(p_content::text,'sha256'),'hex'),author_name) returning id into revision_id;
  insert into public.doc_activity(doc_id,actor_name,event_type,details)
    values(p_doc_id,author_name,'document.saved',jsonb_build_object('revision_id',revision_id,'revision_number',next_revision,'operation_id',p_operation_id));
  response := jsonb_build_object('success',true,'doc_id',p_doc_id,'updated_at',updated_doc.updated_at,'revision_id',revision_id,'revision_number',next_revision);
  insert into public.docs_sync_receipts(actor_id,operation_id,project_id,entity_kind,entity_id,request_hash,result)
    values(auth.uid(),p_operation_id,p_project_id,'document',p_doc_id,request_hash,response);
  return response;
end;
$$;

create or replace function public.heartspace_save_narrative_registry_v2(
  p_project_id uuid, p_operation_id uuid, p_resources jsonb, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  current_registry public.project_narrative_registry%rowtype;
  updated_registry public.project_narrative_registry%rowtype;
  receipt public.docs_sync_receipts%rowtype;
  was_found boolean;
  request_hash text;
  response jsonb;
begin
  if auth.uid() is null or p_project_id is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then
    return jsonb_build_object('success',false,'reason','forbidden');
  end if;
  if p_operation_id is null or jsonb_typeof(p_resources) is distinct from 'object'
    or jsonb_typeof(p_resources->'characters') is distinct from 'array'
    or jsonb_typeof(p_resources->'variables') is distinct from 'array'
    or jsonb_typeof(p_resources->'glossary') is distinct from 'array'
    or jsonb_typeof(p_resources->'sceneSettings') is distinct from 'object' then
    return jsonb_build_object('success',false,'reason','invalid_content');
  end if;
  request_hash := encode(digest(jsonb_build_object('kind','registry','project',p_project_id,'content',p_resources,'expected',extract(epoch from p_expected_updated_at))::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_operation_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('docs-registry:' || p_project_id::text,0));
  select * into current_registry from public.project_narrative_registry r where r.project_id = p_project_id for update;
  was_found := found;
  select * into receipt from public.docs_sync_receipts r where r.actor_id = auth.uid() and r.operation_id = p_operation_id;
  if found then
    if receipt.request_hash <> request_hash then return jsonb_build_object('success',false,'reason','operation_mismatch'); end if;
    if not was_found then return jsonb_build_object('success',false,'reason','not_found'); end if;
    return receipt.result;
  end if;
  if was_found and (p_expected_updated_at is null or current_registry.updated_at is distinct from p_expected_updated_at) then
    return jsonb_build_object('success',false,'conflict',true,'remote_registry',to_jsonb(current_registry));
  end if;
  if not was_found and p_expected_updated_at is not null then return jsonb_build_object('success',false,'reason','not_found'); end if;
  if was_found then
    update public.project_narrative_registry r set characters = p_resources->'characters',variables = p_resources->'variables',
      glossary = p_resources->'glossary',scene_settings = p_resources->'sceneSettings',updated_by = auth.uid(),revision = current_registry.revision+1,
      updated_at = greatest(clock_timestamp(),current_registry.updated_at + interval '1 microsecond')
      where r.project_id = p_project_id returning * into updated_registry;
  else
    insert into public.project_narrative_registry(project_id,characters,variables,glossary,scene_settings,updated_by,revision)
      values(p_project_id,p_resources->'characters',p_resources->'variables',p_resources->'glossary',p_resources->'sceneSettings',auth.uid(),1)
      returning * into updated_registry;
  end if;
  response := jsonb_build_object('success',true,'updated_at',updated_registry.updated_at,'revision',updated_registry.revision);
  insert into public.docs_sync_receipts(actor_id,operation_id,project_id,entity_kind,entity_id,request_hash,result)
    values(auth.uid(),p_operation_id,p_project_id,'registry',p_project_id,request_hash,response);
  return response;
end;
$$;

create or replace function public.heartspace_delete_doc_v2(p_project_id uuid,p_doc_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target public.docs%rowtype;
begin
  if auth.uid() is null or p_project_id is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then return jsonb_build_object('success',false,'reason','forbidden'); end if;
  perform pg_advisory_xact_lock(hashtextextended('docs:' || p_doc_id::text,0));
  select * into target from public.docs d where d.id = p_doc_id for update;
  if not found then return jsonb_build_object('success',true); end if;
  if target.project_id is distinct from p_project_id then return jsonb_build_object('success',false,'reason','forbidden'); end if;
  if p_expected_updated_at is null or target.updated_at is distinct from p_expected_updated_at then return jsonb_build_object('success',false,'conflict',true,'remote_doc',to_jsonb(target)); end if;
  if nullif(target.content #>> '{trash,deleted_at}','') is null then return jsonb_build_object('success',false,'reason','not_trashed'); end if;
  delete from public.docs d where d.id = p_doc_id;
  return jsonb_build_object('success',true);
end;
$$;

-- Keep old RPC callers conditional and atomic; the title belongs to this write.
create or replace function public.heartspace_save_doc_content(
  p_doc_id uuid,p_content jsonb,p_expected_updated_at timestamptz,p_author_name text default 'Membro'
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare target_project uuid;
begin
  select d.project_id into target_project from public.docs d where d.id = p_doc_id;
  if not found then return jsonb_build_object('success',false,'reason','not_found'); end if;
  if p_expected_updated_at is null then return jsonb_build_object('success',false,'reason','base_required'); end if;
  return public.heartspace_save_doc_v2(target_project,p_doc_id,gen_random_uuid(),p_content,p_expected_updated_at,p_author_name);
end;
$$;

create or replace function public.heartspace_restore_doc_revision(
  p_revision_id uuid,p_expected_updated_at timestamptz,p_author_name text default 'Membro'
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare revision public.doc_revisions%rowtype; target_doc public.docs%rowtype; restored jsonb; response jsonb;
begin
  select * into revision from public.doc_revisions r where r.id = p_revision_id;
  if not found then return jsonb_build_object('success',false,'reason','revision_not_found'); end if;
  select * into target_doc from public.docs d where d.id = revision.doc_id;
  if not found then return jsonb_build_object('success',false,'reason','not_found'); end if;
  if p_expected_updated_at is null then return jsonb_build_object('success',false,'reason','base_required'); end if;
  restored := revision.content;
  if target_doc.content->'authoring' is not null then restored := restored || jsonb_build_object('authoring',target_doc.content->'authoring'); end if;
  response := public.heartspace_save_doc_v2(target_doc.project_id,target_doc.id,gen_random_uuid(),restored,p_expected_updated_at,p_author_name);
  if response->>'success' = 'true' then
    update public.doc_revisions r set restored_from_revision_id = revision.id where r.id = (response->>'revision_id')::uuid;
  end if;
  return response;
end;
$$;

create or replace function public.heartspace_approve_doc_revision(p_revision_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare revision public.doc_revisions%rowtype; target_project uuid;
begin
  select * into revision from public.doc_revisions r where r.id = p_revision_id for update;
  if not found then return jsonb_build_object('success',false,'reason','not_found'); end if;
  select d.project_id into target_project from public.docs d where d.id = revision.doc_id;
  if auth.uid() is null or public.heartspace_has_project_capability(target_project,'manage_workspace') is not true then
    return jsonb_build_object('success',false,'reason','forbidden');
  end if;
  if revision.approved_at is null then
    update public.doc_revisions r set approved_by = auth.uid(),approved_at = clock_timestamp() where r.id = p_revision_id;
    insert into public.doc_activity(doc_id,event_type,details) values(revision.doc_id,'revision.approved',jsonb_build_object('revision_id',p_revision_id,'revision_number',revision.revision_number));
  end if;
  return jsonb_build_object('success',true);
end;
$$;

-- Deny blind writes and forged revision approvals from authenticated clients.
revoke insert, update, delete on public.docs from public, anon, authenticated;
revoke insert, update, delete on public.project_narrative_registry from public, anon, authenticated;
revoke insert, update, delete on public.doc_revisions from public, anon, authenticated;
drop policy if exists doc_revisions_insert on public.doc_revisions;
revoke all on function public.heartspace_save_doc_v2(uuid,uuid,uuid,jsonb,timestamptz,text) from public,anon;
revoke all on function public.heartspace_save_narrative_registry_v2(uuid,uuid,jsonb,timestamptz) from public,anon;
revoke all on function public.heartspace_delete_doc_v2(uuid,uuid,timestamptz) from public,anon;
revoke all on function public.heartspace_save_doc_content(uuid,jsonb,timestamptz,text) from public,anon;
revoke all on function public.heartspace_restore_doc_revision(uuid,timestamptz,text) from public,anon;
revoke all on function public.heartspace_approve_doc_revision(uuid) from public,anon;
grant execute on function public.heartspace_save_doc_v2(uuid,uuid,uuid,jsonb,timestamptz,text) to authenticated;
grant execute on function public.heartspace_save_narrative_registry_v2(uuid,uuid,jsonb,timestamptz) to authenticated;
grant execute on function public.heartspace_delete_doc_v2(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.heartspace_save_doc_content(uuid,jsonb,timestamptz,text) to authenticated;
grant execute on function public.heartspace_restore_doc_revision(uuid,timestamptz,text) to authenticated;
grant execute on function public.heartspace_approve_doc_revision(uuid) to authenticated;
commit;
