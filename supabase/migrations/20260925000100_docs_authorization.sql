-- HeartSpace Docs: autorização central por projeto.
-- Depende de SUPABASE_PROJECT_ROLE_SYSTEM.sql. A função é usada tanto pelas
-- políticas RLS quanto pelo Hub para projetar uma sessão mínima ao Docs.

create or replace function public.heartspace_project_access(target_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_project public.projects%rowtype;
  studio_role text := '';
  member_roles jsonb := '[]'::jsonb;
  has_project_membership boolean := false;
  effective_role text := 'reader';
  capabilities jsonb := '{"docs_view": false, "docs_edit": false, "docs_comment": false, "manage_publications": false}'::jsonb;
begin
  select * into target_project from public.projects where id = target_project_id;
  if not found then
    return jsonb_build_object('project_id', target_project_id, 'role', 'reader', 'capabilities', capabilities);
  end if;

  select sm.role into studio_role
  from public.studio_members sm
  where sm.studio_id = target_project.studio_id and sm.user_id = auth.uid()
  limit 1;

  if target_project.owner_id = auth.uid() or studio_role in ('owner', 'admin') then
    effective_role := 'owner';
    capabilities := '{"docs_view": true, "docs_edit": true, "docs_comment": true, "manage_publications": true, "manage_workspace": true}'::jsonb;
  else
    select coalesce(pm.role, 'reader'), pm.roles into effective_role, member_roles
    from public.project_members pm
    where pm.project_id = target_project_id and pm.user_id = auth.uid()
    limit 1;
    has_project_membership := found;
    if not has_project_membership then
      return jsonb_build_object('project_id', target_project_id, 'role', 'reader', 'capabilities', capabilities);
    end if;
    if member_roles is null then member_roles := '[]'::jsonb; end if;
    if jsonb_array_length(member_roles) = 0 and effective_role <> 'reader' then
      member_roles := jsonb_build_array(effective_role);
    end if;

    -- Leitura não é inferida para quem não pertence ao projeto. Para membros,
    -- o papel reader mantém a visualização e cargos configuráveis acumulam
    -- somente as permissões declaradas no catálogo do projeto.
    capabilities := jsonb_set(capabilities, '{docs_view}', 'true'::jsonb);
    select capabilities || coalesce(jsonb_object_agg(permission_key, true), '{}'::jsonb)
    into capabilities
    from (
      select distinct permission_key
      from jsonb_array_elements_text(member_roles) role_key
      cross join lateral jsonb_each(coalesce(target_project.role_permissions -> role_key, '{}'::jsonb)) granted(permission_key, enabled)
      where granted.enabled = to_jsonb(true)
    ) permissions;
    if effective_role in ('commenter', 'commentator') then
      capabilities := capabilities || '{"docs_view": true, "docs_comment": true}'::jsonb;
    end if;
  end if;

  -- Compatibilidade transitória: o catálogo antigo chama as capacidades do
  -- wiki. Não deixe isso contornar a ausência de associação ao projeto.
  if coalesce((capabilities ->> 'can_view_wiki')::boolean, false) then
    capabilities := capabilities || '{"docs_view": true}'::jsonb;
  end if;
  if coalesce((capabilities ->> 'can_edit_wiki')::boolean, false) then
    capabilities := capabilities || '{"docs_edit": true, "docs_view": true}'::jsonb;
  end if;
  if coalesce((capabilities ->> 'can_comment_wiki')::boolean, false) then
    capabilities := capabilities || '{"docs_comment": true, "docs_view": true}'::jsonb;
  end if;
  if coalesce((capabilities ->> 'manage_workspace')::boolean, false) then
    capabilities := capabilities || '{"manage_publications": true}'::jsonb;
  end if;
  return jsonb_build_object('project_id', target_project_id, 'role', effective_role, 'capabilities', capabilities);
end;
$$;

revoke all on function public.heartspace_project_access(uuid) from public, anon;
grant execute on function public.heartspace_project_access(uuid) to authenticated;

create or replace function public.heartspace_has_project_capability(target_project_id uuid, capability text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.heartspace_project_access(target_project_id)->'capabilities'->>capability)::boolean, false)
$$;

revoke all on function public.heartspace_has_project_capability(uuid, text) from public, anon;
grant execute on function public.heartspace_has_project_capability(uuid, text) to authenticated;

alter table public.docs enable row level security;
drop policy if exists heartspace_docs_read on public.docs;
drop policy if exists heartspace_docs_insert on public.docs;
drop policy if exists heartspace_docs_update on public.docs;
drop policy if exists heartspace_docs_delete on public.docs;
create policy heartspace_docs_read on public.docs for select to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_view'));
create policy heartspace_docs_insert on public.docs for insert to authenticated
  with check (public.heartspace_has_project_capability(project_id, 'docs_edit'));
create policy heartspace_docs_update on public.docs for update to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_edit'))
  with check (public.heartspace_has_project_capability(project_id, 'docs_edit'));
create policy heartspace_docs_delete on public.docs for delete to authenticated
  using (public.heartspace_has_project_capability(project_id, 'docs_edit'));

-- Instalações que ainda não executaram a migration histórica de colaboração
-- recebem as tabelas aqui, antes das respectivas políticas RLS.
create table if not exists public.doc_comments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  block_id text not null,
  parent_id uuid references public.doc_comments(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default 'Membro',
  body text not null check (char_length(body) between 1 and 8000),
  quote text not null default '',
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists doc_comments_doc_block_idx on public.doc_comments(doc_id, block_id, created_at);

create table if not exists public.doc_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  doc_id uuid not null references public.docs(id) on delete cascade,
  comment_id uuid references public.doc_comments(id) on delete cascade,
  kind text not null default 'mention',
  message text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists doc_notifications_recipient_idx on public.doc_notifications(recipient_id, read_at, created_at desc);

create table if not exists public.doc_activity (
  id bigint generated always as identity primary key,
  doc_id uuid not null references public.docs(id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users(id) on delete set null,
  actor_name text not null default 'Membro',
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists doc_activity_doc_created_idx on public.doc_activity(doc_id, created_at desc);

alter table public.doc_comments enable row level security;
drop policy if exists heartspace_doc_comments_read on public.doc_comments;
drop policy if exists heartspace_doc_comments_insert on public.doc_comments;
drop policy if exists heartspace_doc_comments_update on public.doc_comments;
create policy heartspace_doc_comments_read on public.doc_comments for select to authenticated
  using (exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_view')));
create policy heartspace_doc_comments_insert on public.doc_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_comment')));
create policy heartspace_doc_comments_update on public.doc_comments for update to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_edit')));

alter table public.doc_notifications enable row level security;
drop policy if exists heartspace_doc_notifications_insert on public.doc_notifications;
create policy heartspace_doc_notifications_insert on public.doc_notifications for insert to authenticated
  with check (exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_comment')));

alter table public.doc_activity enable row level security;
drop policy if exists heartspace_doc_activity_insert on public.doc_activity;
create policy heartspace_doc_activity_insert on public.doc_activity for insert to authenticated
  with check (actor_id = auth.uid() and exists (select 1 from public.docs d where d.id = doc_id and public.heartspace_has_project_capability(d.project_id, 'docs_comment')));
