-- HeartSpace: segunda migration do gerenciador — convites de estúdio.
-- Aplique somente depois de SUPABASE_STUDIO_SCHEMA.sql.

create or replace function public.admin_create_studio_invite(
    p_actor_id uuid, p_studio_id uuid, p_email text, p_role text,
    p_token_hash text, p_expires_at timestamptz
)
returns public.studio_invites language plpgsql security definer set search_path = public as $$
declare created_invite public.studio_invites;
begin
    if not exists (select 1 from public.studio_members where studio_id = p_studio_id and user_id = p_actor_id and role in ('owner', 'admin')) then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    if p_email <> lower(trim(p_email)) or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
       or p_role not in ('admin', 'member') or char_length(p_token_hash) < 32 or p_expires_at <= now() then
        raise exception 'invalid invitation input' using errcode = '22023';
    end if;
    update public.studio_invites set revoked_at = now()
    where studio_id = p_studio_id and email = p_email and accepted_at is null and revoked_at is null;
    insert into public.studio_invites (studio_id, email, role, token_hash, created_by, expires_at)
    values (p_studio_id, p_email, p_role, p_token_hash, p_actor_id, p_expires_at)
    returning * into created_invite;
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (p_studio_id, p_actor_id, 'invite.created', 'invite', created_invite.id::text);
    return created_invite;
end;
$$;

create or replace function public.admin_accept_studio_invite(p_actor_id uuid, p_email text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare invite_row public.studio_invites;
begin
    select * into invite_row from public.studio_invites
    where token_hash = p_token_hash and email = lower(trim(p_email)) and accepted_at is null and revoked_at is null and expires_at > now()
    for update;
    if not found then raise exception 'invalid or expired invitation' using errcode = '22023'; end if;
    insert into public.studio_members (studio_id, user_id, role) values (invite_row.studio_id, p_actor_id, invite_row.role)
    on conflict (studio_id, user_id) do nothing;
    update public.studio_invites set accepted_at = now() where id = invite_row.id;
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (invite_row.studio_id, p_actor_id, 'invite.accepted', 'invite', invite_row.id::text);
    return invite_row.studio_id;
end;
$$;

revoke all on function public.admin_create_studio_invite(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.admin_accept_studio_invite(uuid, text, text) from public, anon, authenticated;
