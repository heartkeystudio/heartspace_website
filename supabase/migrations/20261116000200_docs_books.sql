-- Docs integration: books are independent entities, not chapter snapshots.
-- Apply after 20261116000100; deploy with the book-aware client. No external provider credentials.
begin;
-- Stabilize legacy snapshots while the independent source is installed.
lock table public.docs in share row exclusive mode;
create table public.docs_books (
  project_id uuid not null references public.projects(id) on delete cascade,
  id text not null check (length(id) between 1 and 512),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content->>'schema_version' = '1' and content->>'id' = id),
  revision bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  primary key (project_id,id)
);
create table public.docs_book_revisions (
  project_id uuid not null,
  book_id text not null,
  revision_number bigint not null,
  content jsonb not null,
  deleted boolean not null default false,
  origin text not null default 'book' check (origin in ('book','legacy-document')),
  origin_doc_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (project_id,book_id,revision_number),
  foreign key(project_id,book_id) references public.docs_books(project_id,id) on delete cascade
);
-- Text authoring IDs must remain stable, including legacy folder-doc-* IDs.
create table public.docs_book_receipts (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  book_id text not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,operation_id)
);
alter table public.docs_books enable row level security;
alter table public.docs_book_revisions enable row level security;
alter table public.docs_book_receipts enable row level security;
revoke all on public.docs_books, public.docs_book_revisions, public.docs_book_receipts from public,anon,authenticated;
grant select on public.docs_books, public.docs_book_revisions to authenticated;
create policy docs_books_read on public.docs_books for select to authenticated
  using (public.heartspace_has_project_capability(project_id,'docs_view'));
create policy docs_book_revisions_read on public.docs_book_revisions for select to authenticated
  using (public.heartspace_has_project_capability(project_id,'docs_view'));
create index docs_books_changed on public.docs_books(project_id,updated_at);

-- Keep every distinct old snapshot. Selecting the newest chapter is only the
-- initial projection; older alternatives remain immutable, accessible history.
create temporary table docs_legacy_books on commit drop as
with candidates as (
  select d.project_id,d.id as doc_id,coalesce(d.updated_at,clock_timestamp()) as updated_at,
    d.content #>> '{organization,folder_id}' as book_id,
    coalesce(case when jsonb_typeof(d.content #> '{organization,collection}') = 'object'
      then d.content #> '{organization,collection}' end,'{}'::jsonb) as snapshot,
    d.content #>> '{organization,folder_name}' as folder_name,d.content->>'layout' as layout,
    coalesce(d.content #>> '{authoring,document_id}',d.id::text) as authoring_id,d.title,
    d.content->'story_planning' as chapter_plan
  from public.docs d
  where d.content->>'format' = 'heartspace-html-v1'
    and length(coalesce(d.content #>> '{organization,folder_id}','')) between 1 and 512
), chapter_sources as (
 select project_id,book_id,jsonb_agg(jsonb_build_object('documentId',authoring_id,'title',title,'plan',chapter_plan) order by doc_id) as plans,
   jsonb_agg(authoring_id order by doc_id) as ids
 from candidates where jsonb_typeof(chapter_plan) = 'object' and (
   coalesce(chapter_plan->>'beginning','') <> '' or coalesce(chapter_plan->>'middle','') <> '' or coalesce(chapter_plan->>'ending','') <> ''
   or case when jsonb_typeof(chapter_plan->'milestones') = 'array' then jsonb_array_length(chapter_plan->'milestones') > 0 else false end
   or case when jsonb_typeof(chapter_plan->'worldEntries') = 'array' then jsonb_array_length(chapter_plan->'worldEntries') > 0 else false end)
 group by project_id,book_id
), normalized as (
 select c.project_id,doc_id,updated_at,c.book_id,jsonb_build_object(
   'schema_version',1,'id',book_id,'name',coalesce(nullif(snapshot->>'name',''),nullif(folder_name,''),'Livro'),
   'layout',case when coalesce(snapshot->>'layout',layout) = 'canvas' then 'canvas' else 'book' end,
   'storyPlanning',coalesce(snapshot->'storyPlanning','{}'::jsonb),
   'migratedDocuments',(case when jsonb_typeof(snapshot->'migratedDocuments') = 'array' then snapshot->'migratedDocuments' else '[]'::jsonb end) || coalesce(cs.ids,'[]'::jsonb),
   'legacyPlans',(case when jsonb_typeof(snapshot->'legacyPlans') = 'array' then snapshot->'legacyPlans' else '[]'::jsonb end) || coalesce(cs.plans,'[]'::jsonb)) as content
 from candidates c left join chapter_sources cs using(project_id,book_id)
), distinct_sources as (
 select distinct on(project_id,book_id,content) * from normalized order by project_id,book_id,content,updated_at desc,doc_id
)
select *,row_number() over(partition by project_id,book_id order by updated_at,doc_id) as version from distinct_sources;
insert into public.docs_books(project_id,id,content,revision,updated_at)
 select distinct on(project_id,book_id) project_id,book_id,content,version,clock_timestamp()
 from docs_legacy_books order by project_id,book_id,version desc;
insert into public.docs_book_revisions(project_id,book_id,revision_number,content,origin,origin_doc_id,created_at)
 select project_id,book_id,version,content,'legacy-document',doc_id,updated_at from docs_legacy_books;

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
  -- All document parent changes and book deletion share this project lock.
  -- Acquire it before operation/doc locks, including for replayed requests.
  perform pg_advisory_xact_lock(hashtextextended('docs-structure:' || p_project_id::text,0));
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

  if coalesce(p_content #>> '{organization,folder_id}','') <> '' and not exists (
    select 1 from public.docs_books b where b.project_id = p_project_id
      and b.id = p_content #>> '{organization,folder_id}' and b.deleted_at is null
  ) then
    return jsonb_build_object('success',false,'reason','book_unavailable');
  end if;

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

create or replace function public.heartspace_save_book_v1(
  p_project_id uuid,p_book_id text,p_operation_id uuid,p_content jsonb,
  p_deleted boolean,p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  current_book public.docs_books%rowtype;
  updated_book public.docs_books%rowtype;
  receipt public.docs_book_receipts%rowtype;
  was_found boolean;
  request_hash text;
  response jsonb;
  child record;
  moved jsonb;
begin
  if auth.uid() is null or p_project_id is null or public.heartspace_has_project_capability(p_project_id,'docs_edit') is not true then
    return jsonb_build_object('success',false,'reason','forbidden');
  end if;
  if p_operation_id is null or p_deleted is null or p_book_id is null or length(p_book_id) not between 1 and 512
    or jsonb_typeof(p_content) is distinct from 'object' or p_content->>'schema_version' is distinct from '1'
    or p_content->>'id' is distinct from p_book_id or jsonb_typeof(p_content->'name') is distinct from 'string'
    or p_content->>'layout' not in ('book','canvas') or p_content->>'layout' is null
    or jsonb_typeof(p_content->'storyPlanning') is distinct from 'object'
    or jsonb_typeof(p_content->'legacyPlans') is distinct from 'array'
    or jsonb_typeof(p_content->'migratedDocuments') is distinct from 'array' then
    return jsonb_build_object('success',false,'reason','invalid_content');
  end if;
  request_hash := encode(digest(jsonb_build_object('kind','book','project',p_project_id,'id',p_book_id,'content',p_content,'deleted',p_deleted,'expected',extract(epoch from p_expected_updated_at))::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('docs-structure:' || p_project_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_operation_id::text,0));
  select * into current_book from public.docs_books b where b.project_id = p_project_id and b.id = p_book_id for update;
  was_found := found;
  select * into receipt from public.docs_book_receipts r where r.actor_id = auth.uid() and r.operation_id = p_operation_id;
  if found then
    if receipt.request_hash <> request_hash then return jsonb_build_object('success',false,'reason','operation_mismatch'); end if;
    if not was_found then return jsonb_build_object('success',false,'reason','not_found'); end if;
    return receipt.result;
  end if;
  if was_found and (p_expected_updated_at is null or current_book.updated_at is distinct from p_expected_updated_at) then
    return jsonb_build_object('success',false,'conflict',true,'remote_book',to_jsonb(current_book));
  end if;
  if not was_found and p_expected_updated_at is not null then return jsonb_build_object('success',false,'reason','not_found'); end if;
  if was_found and current_book.content = p_content and (current_book.deleted_at is not null) = p_deleted then
    response := jsonb_build_object('success',true,'updated_at',current_book.updated_at,'revision',current_book.revision);
  else
    if was_found then
      update public.docs_books b set content = p_content,revision = current_book.revision+1,updated_by = auth.uid(),
        updated_at = greatest(clock_timestamp(),current_book.updated_at + interval '1 microsecond'),
        deleted_at = case when p_deleted then clock_timestamp() else null end
        where b.project_id = p_project_id and b.id = p_book_id returning * into updated_book;
    else
      insert into public.docs_books(project_id,id,content,updated_by,deleted_at)
        values(p_project_id,p_book_id,p_content,auth.uid(),case when p_deleted then clock_timestamp() else null end) returning * into updated_book;
    end if;
    if p_deleted then
      -- This lock order matches save_doc_v2. Move the latest source, not a stale
      -- client copy; each detach generates the ordinary document revision.
      for child in select d.* from public.docs d where d.project_id = p_project_id
        and d.content #>> '{organization,folder_id}' = p_book_id order by d.id for update loop
        moved := jsonb_set(child.content,'{organization}',
          coalesce(child.content->'organization','{}'::jsonb) || jsonb_build_object('schema_version',2,'collection',null,'folder_id','','folder_name',''));
        response := public.heartspace_save_doc_v2(p_project_id,child.id,gen_random_uuid(),moved,child.updated_at,'Membro');
        if response->>'success' is distinct from 'true' then raise exception 'Book detach failed: %',response; end if;
      end loop;
    end if;
    insert into public.docs_book_revisions(project_id,book_id,revision_number,content,deleted,created_by)
      values(p_project_id,p_book_id,updated_book.revision,p_content,p_deleted,auth.uid());
    response := jsonb_build_object('success',true,'updated_at',updated_book.updated_at,'revision',updated_book.revision);
  end if;
  insert into public.docs_book_receipts(actor_id,operation_id,project_id,book_id,request_hash,result)
    values(auth.uid(),p_operation_id,p_project_id,p_book_id,request_hash,response);
  return response;
end;
$$;
revoke all on function public.heartspace_save_book_v1(uuid,text,uuid,jsonb,boolean,timestamptz) from public,anon;
grant execute on function public.heartspace_save_book_v1(uuid,text,uuid,jsonb,boolean,timestamptz) to authenticated;
commit;
