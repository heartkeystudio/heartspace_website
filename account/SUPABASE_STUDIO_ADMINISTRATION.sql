-- HeartSpace: operações administrativas de estúdio.
-- Aplique depois de SUPABASE_STUDIO_SCHEMA.sql, SUPABASE_STUDIOS_COMPATIBILITY.sql,
-- SUPABASE_PROFILE_BRIDGE.sql e SUPABASE_STUDIO_INVITES.sql.
-- Todas as funções abaixo são chamadas somente pela Edge Function com service role.

alter table public.studios add column if not exists description text;

create or replace function public.admin_update_studio(
    p_actor_id uuid, p_studio_id uuid, p_name text, p_description text
)
returns public.studios language plpgsql security definer set search_path = public as $$
declare updated_studio public.studios;
begin
    if not exists (
        select 1 from public.studio_members
        where studio_id = p_studio_id and user_id = p_actor_id and role in ('owner', 'admin')
    ) then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    if char_length(trim(p_name)) not between 2 and 80 or char_length(coalesce(p_description, '')) > 500 then
        raise exception 'invalid studio input' using errcode = '22023';
    end if;

    update public.studios
    set name = trim(p_name), description = nullif(trim(coalesce(p_description, '')), '')
    where id = p_studio_id
    returning * into updated_studio;

    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (p_studio_id, p_actor_id, 'studio.updated', 'studio', p_studio_id::text);
    return updated_studio;
end;
$$;

create or replace function public.admin_update_studio_member_role(
    p_actor_id uuid, p_studio_id uuid, p_target_user_id uuid, p_role text
)
returns void language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
    if not exists (
        select 1 from public.studio_members
        where studio_id = p_studio_id and user_id = p_actor_id and role = 'owner'
    ) then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    select role into target_role from public.studio_members
    where studio_id = p_studio_id and user_id = p_target_user_id for update;
    if not found or target_role = 'owner' or p_role not in ('admin', 'member') then
        raise exception 'invalid member update' using errcode = '22023';
    end if;

    update public.studio_members set role = p_role
    where studio_id = p_studio_id and user_id = p_target_user_id;
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (p_studio_id, p_actor_id, 'member.role_updated', 'member', p_target_user_id::text);
end;
$$;

create or replace function public.admin_remove_studio_member(
    p_actor_id uuid, p_studio_id uuid, p_target_user_id uuid
)
returns void language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
    if not exists (
        select 1 from public.studio_members
        where studio_id = p_studio_id and user_id = p_actor_id and role = 'owner'
    ) then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    select role into target_role from public.studio_members
    where studio_id = p_studio_id and user_id = p_target_user_id for update;
    if not found or p_target_user_id = p_actor_id or target_role = 'owner' then
        raise exception 'invalid member removal' using errcode = '22023';
    end if;

    delete from public.studio_members where studio_id = p_studio_id and user_id = p_target_user_id;
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (p_studio_id, p_actor_id, 'member.removed', 'member', p_target_user_id::text);
end;
$$;

create or replace function public.admin_revoke_studio_invite(
    p_actor_id uuid, p_studio_id uuid, p_invite_id uuid
)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not exists (
        select 1 from public.studio_members
        where studio_id = p_studio_id and user_id = p_actor_id and role in ('owner', 'admin')
    ) then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    update public.studio_invites set revoked_at = now()
    where id = p_invite_id and studio_id = p_studio_id and accepted_at is null and revoked_at is null;
    if not found then
        raise exception 'invalid invitation' using errcode = '22023';
    end if;
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (p_studio_id, p_actor_id, 'invite.revoked', 'invite', p_invite_id::text);
end;
$$;

revoke all on function public.admin_update_studio(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_update_studio_member_role(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_remove_studio_member(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_revoke_studio_invite(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_update_studio(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_update_studio_member_role(uuid, uuid, uuid, text) to service_role;
grant execute on function public.admin_remove_studio_member(uuid, uuid, uuid) to service_role;
grant execute on function public.admin_revoke_studio_invite(uuid, uuid, uuid) to service_role;
notify pgrst, 'reload schema';
