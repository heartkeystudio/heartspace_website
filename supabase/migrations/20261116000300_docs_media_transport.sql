-- Docs integration 5B: immutable private runtime media, outside authoring rows/history.
-- Requires 20261116000100 and 20261116000200; deploy with the media-aware client.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('docs-media','docs-media',false,8388608,array['image/png','image/jpeg','image/webp','audio/mpeg','audio/ogg','audio/wav','audio/webm','audio/mp4'])
on conflict(id) do update set public = false,file_size_limit = excluded.file_size_limit,allowed_mime_types = excluded.allowed_mime_types;

create table public.docs_media_objects (
  project_id uuid not null references public.projects(id) on delete cascade,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  path text not null,
  mime text not null,
  bytes bigint not null check (bytes > 0 and bytes <= 8388608),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(project_id,sha256),unique(path)
);
alter table public.docs_media_objects enable row level security;
revoke all on public.docs_media_objects from public,anon,authenticated;
grant select on public.docs_media_objects to authenticated;
create policy docs_media_objects_read on public.docs_media_objects for select to authenticated
  using (public.heartspace_has_project_capability(project_id,'docs_view'));

-- Avoid casting an untrusted folder to UUID in a policy expression.
create function public.heartspace_docs_media_project(p_path text) returns uuid
language plpgsql immutable set search_path = public as $$
begin
  if p_path ~ '^[a-f0-9-]{36}/[a-f0-9]{64}\.(png|jpg|webp|mp3|ogg|wav|webm|m4a)$' then
    begin return split_part(p_path,'/',1)::uuid; exception when invalid_text_representation then return null; end;
  end if;
  return null;
end; $$;
revoke all on function public.heartspace_docs_media_project(text) from public,anon;
grant execute on function public.heartspace_docs_media_project(text) to authenticated;
create policy docs_media_read on storage.objects for select to authenticated using (
  bucket_id = 'docs-media' and public.heartspace_has_project_capability(public.heartspace_docs_media_project(name),'docs_view')
);
create policy docs_media_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'docs-media' and public.heartspace_has_project_capability(public.heartspace_docs_media_project(name),'docs_edit')
);
-- No UPDATE/DELETE policy: a revision must not lose or silently change its files.
-- Orphan cleanup/retention is an explicit later server operation, not a client action.

create function public.heartspace_register_docs_media_v1(p_project_id uuid,p_sha256 text,p_mime text,p_bytes bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare suffix text; object_path text; stored record; existing public.docs_media_objects%rowtype;
begin
  if auth.uid() is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then return jsonb_build_object('success',false,'reason','forbidden'); end if;
  suffix := case p_mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' when 'audio/mpeg' then 'mp3' when 'audio/ogg' then 'ogg' when 'audio/wav' then 'wav' when 'audio/webm' then 'webm' when 'audio/mp4' then 'm4a' end;
  if suffix is null or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes < 1
    or p_bytes > case when p_mime like 'image/%' then 4194304 else 8388608 end then return jsonb_build_object('success',false,'reason','invalid_media'); end if;
  object_path := p_project_id::text || '/' || p_sha256 || '.' || suffix;
  perform pg_advisory_xact_lock(hashtextextended('docs-media:' || object_path,0));
  select s.metadata into stored from storage.objects s where s.bucket_id = 'docs-media' and s.name = object_path;
  if not found then return jsonb_build_object('success',false,'reason','media_unavailable'); end if;
  if (stored.metadata->>'size') is distinct from p_bytes::text or (stored.metadata->>'mimetype') is distinct from p_mime then
    return jsonb_build_object('success',false,'reason','metadata_mismatch');
  end if;
  insert into public.docs_media_objects(project_id,sha256,path,mime,bytes,created_by)
    values(p_project_id,p_sha256,object_path,p_mime,p_bytes,auth.uid()) on conflict(project_id,sha256) do nothing;
  select * into existing from public.docs_media_objects m where m.project_id = p_project_id and m.sha256 = p_sha256;
  if existing.path <> object_path or existing.mime <> p_mime or existing.bytes <> p_bytes then return jsonb_build_object('success',false,'reason','metadata_mismatch'); end if;
  return jsonb_build_object('success',true);
end; $$;

-- Validate every structured reference, plus the manifest of HTML image refs.
-- File hashes are checked on clients against actual bytes. SQL checks registration,
-- project, immutable path/type/size and that the object is still present.
create function public.heartspace_check_docs_media_v1(p_project_id uuid,p_source jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare queue jsonb[] := array[p_source]; current_node jsonb; child jsonb; ref jsonb; seen integer := 0; media public.docs_media_objects%rowtype;
begin
  while cardinality(queue) > 0 loop
    current_node := queue[cardinality(queue)]; queue := queue[1:cardinality(queue)-1]; seen := seen+1;
    if seen > 500000 then return false; end if;
    if jsonb_typeof(current_node) = 'object' then
      if current_node ? 'storage_ref' then
        ref := current_node->'storage_ref';
        if jsonb_typeof(ref) is distinct from 'object' or ref->>'schema_version' is distinct from '1'
          or ref->>'bucket' is distinct from 'docs-media' or ref->>'project_id' is distinct from p_project_id::text
          or current_node->>'mime' is distinct from ref->>'mime' or current_node ? 'data' then return false; end if;
        select * into media from public.docs_media_objects m where m.project_id = p_project_id and m.sha256 = ref->>'sha256';
        if not found or media.path is distinct from ref->>'path' or media.mime is distinct from ref->>'mime' or media.bytes::text is distinct from ref->>'bytes'
          or not exists(select 1 from storage.objects s where s.bucket_id = 'docs-media' and s.name = media.path) then return false; end if;
      end if;
      if current_node ? '_docs_media' then
        if current_node #>> '{_docs_media,schema_version}' is distinct from '1' or jsonb_typeof(current_node #> '{_docs_media,assets}') is distinct from 'array' then return false; end if;
        if jsonb_array_length(current_node #> '{_docs_media,assets}') > 10000 then return false; end if;
        for ref in select value from jsonb_array_elements(current_node #> '{_docs_media,assets}') loop
          -- Use the same reference validation, without a second source authority.
          queue := array_append(queue,jsonb_build_object('mime',ref->>'mime','storage_ref',ref));
        end loop;
      end if;
      if current_node->>'data' like 'data:%' and (current_node->>'mime' like 'image/%' or current_node->>'mime' like 'audio/%') then return false; end if;
      if current_node->>'format' = 'heartspace-html-v1' then
        if current_node->>'body' ~* $pattern$<img\y[^>]*\ysrc[[:space:]]*=[[:space:]]*["']?data:image/$pattern$ then return false; end if;
        if current_node->>'body' like '%data-docs-media=%' and not (current_node ? '_docs_media') then return false; end if;
      end if;
      for child in select value from jsonb_each(current_node) loop queue := array_append(queue,child); end loop;
    elsif jsonb_typeof(current_node) = 'array' then
      for child in select value from jsonb_array_elements(current_node) loop queue := array_append(queue,child); end loop;
    end if;
  end loop;
  return true;
end; $$;
-- This helper is private; wrappers below authorize before using it.
revoke all on function public.heartspace_check_docs_media_v1(uuid,jsonb) from public,anon,authenticated;

create function public.heartspace_save_doc_v3(p_project_id uuid,p_doc_id uuid,p_operation_id uuid,p_content jsonb,p_expected_updated_at timestamptz,p_author_name text default 'Membro')
returns jsonb language plpgsql security definer set search_path = public,extensions as $$
begin
  if auth.uid() is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then return jsonb_build_object('success',false,'reason','forbidden'); end if;
  if not public.heartspace_check_docs_media_v1(p_project_id,p_content) then return jsonb_build_object('success',false,'reason','media_unavailable'); end if;
  return public.heartspace_save_doc_v2(p_project_id,p_doc_id,p_operation_id,p_content,p_expected_updated_at,p_author_name);
end; $$;
create function public.heartspace_save_narrative_registry_v3(p_project_id uuid,p_operation_id uuid,p_resources jsonb,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public,extensions as $$
begin
  if auth.uid() is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then return jsonb_build_object('success',false,'reason','forbidden'); end if;
  if not public.heartspace_check_docs_media_v1(p_project_id,p_resources) then return jsonb_build_object('success',false,'reason','media_unavailable'); end if;
  return public.heartspace_save_narrative_registry_v2(p_project_id,p_operation_id,p_resources,p_expected_updated_at);
end; $$;
create function public.heartspace_save_book_v2(p_project_id uuid,p_book_id text,p_operation_id uuid,p_content jsonb,p_deleted boolean,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public,extensions as $$
begin
  if auth.uid() is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then return jsonb_build_object('success',false,'reason','forbidden'); end if;
  if not public.heartspace_check_docs_media_v1(p_project_id,p_content) then return jsonb_build_object('success',false,'reason','media_unavailable'); end if;
  return public.heartspace_save_book_v1(p_project_id,p_book_id,p_operation_id,p_content,p_deleted,p_expected_updated_at);
end; $$;

-- Recover old lost acknowledgments by the exact old request hash. Never accept
-- a new inline write through this compatibility endpoint.
create function public.heartspace_resume_docs_sync_v1(p_project_id uuid,p_kind text,p_entity_id text,p_operation_id uuid,p_content jsonb,p_expected_updated_at timestamptz,p_deleted boolean default false)
returns jsonb language plpgsql security definer set search_path = public,extensions as $$
declare expected_hash text; saved_hash text; response jsonb; doc_id uuid; exists_now boolean;
begin
  if auth.uid() is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then return jsonb_build_object('accepted',false,'reason','forbidden'); end if;
  if p_kind = 'document' then
    begin doc_id := p_entity_id::uuid; exception when invalid_text_representation then return jsonb_build_object('accepted',false,'reason','invalid_identity'); end;
    expected_hash := encode(digest(jsonb_build_object('kind','document','project',p_project_id,'id',doc_id,'content',p_content,'expected',extract(epoch from p_expected_updated_at))::text,'sha256'),'hex');
    select r.request_hash,r.result into saved_hash,response from public.docs_sync_receipts r where r.actor_id = auth.uid() and r.operation_id = p_operation_id and r.project_id = p_project_id and r.entity_kind = 'document' and r.entity_id = doc_id;
    select exists(select 1 from public.docs d where d.id = doc_id and d.project_id = p_project_id) into exists_now;
  elsif p_kind = 'registry' then
    expected_hash := encode(digest(jsonb_build_object('kind','registry','project',p_project_id,'content',p_content,'expected',extract(epoch from p_expected_updated_at))::text,'sha256'),'hex');
    select r.request_hash,r.result into saved_hash,response from public.docs_sync_receipts r where r.actor_id = auth.uid() and r.operation_id = p_operation_id and r.project_id = p_project_id and r.entity_kind = 'registry' and r.entity_id = p_project_id;
    select exists(select 1 from public.project_narrative_registry r where r.project_id = p_project_id) into exists_now;
  elsif p_kind = 'book' then
    expected_hash := encode(digest(jsonb_build_object('kind','book','project',p_project_id,'id',p_entity_id,'content',p_content,'deleted',p_deleted,'expected',extract(epoch from p_expected_updated_at))::text,'sha256'),'hex');
    select r.request_hash,r.result into saved_hash,response from public.docs_book_receipts r where r.actor_id = auth.uid() and r.operation_id = p_operation_id and r.project_id = p_project_id and r.book_id = p_entity_id;
    select exists(select 1 from public.docs_books b where b.project_id = p_project_id and b.id = p_entity_id) into exists_now;
  else return jsonb_build_object('accepted',false,'reason','invalid_kind');
  end if;
  if saved_hash is null then return jsonb_build_object('accepted',false,'reason','not_accepted'); end if;
  if saved_hash <> expected_hash then return jsonb_build_object('accepted',false,'reason','operation_mismatch'); end if;
  if not exists_now then response := jsonb_build_object('success',false,'reason','not_found'); end if;
  return jsonb_build_object('accepted',true,'result',response);
end; $$;

-- Older inline contracts stay internal for atomic detach and compatibility hashes.
revoke all on function public.heartspace_save_doc_v2(uuid,uuid,uuid,jsonb,timestamptz,text) from public,anon,authenticated;
revoke all on function public.heartspace_save_narrative_registry_v2(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.heartspace_save_book_v1(uuid,text,uuid,jsonb,boolean,timestamptz) from public,anon,authenticated;
revoke all on function public.heartspace_save_doc_content(uuid,jsonb,timestamptz,text) from public,anon,authenticated;
revoke all on function public.heartspace_restore_doc_revision(uuid,timestamptz,text) from public,anon,authenticated;
revoke all on function public.heartspace_register_docs_media_v1(uuid,text,text,bigint) from public,anon;
revoke all on function public.heartspace_save_doc_v3(uuid,uuid,uuid,jsonb,timestamptz,text) from public,anon;
revoke all on function public.heartspace_save_narrative_registry_v3(uuid,uuid,jsonb,timestamptz) from public,anon;
revoke all on function public.heartspace_save_book_v2(uuid,text,uuid,jsonb,boolean,timestamptz) from public,anon;
revoke all on function public.heartspace_resume_docs_sync_v1(uuid,text,text,uuid,jsonb,timestamptz,boolean) from public,anon;
grant execute on function public.heartspace_register_docs_media_v1(uuid,text,text,bigint) to authenticated;
grant execute on function public.heartspace_save_doc_v3(uuid,uuid,uuid,jsonb,timestamptz,text) to authenticated;
grant execute on function public.heartspace_save_narrative_registry_v3(uuid,uuid,jsonb,timestamptz) to authenticated;
grant execute on function public.heartspace_save_book_v2(uuid,text,uuid,jsonb,boolean,timestamptz) to authenticated;
grant execute on function public.heartspace_resume_docs_sync_v1(uuid,text,text,uuid,jsonb,timestamptz,boolean) to authenticated;
commit;
