-- HeartSpace: compatibilidade para aceitar convites em bancos com profiles legados.
-- Aplique APÓS SUPABASE_STUDIO_INVITES.sql e SUPABASE_PROFILE_BRIDGE.sql.
--
-- Motivo: studio_members referencia public.profiles. Uma pessoa que acabou de
-- criar a conta ainda pode não ter essa linha legada; ela é criada vazia, sem
-- copiar ou inventar dados pessoais, antes de receber o papel no estúdio.

create or replace function public.admin_accept_studio_invite(p_actor_id uuid, p_email text, p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare invite_row public.studio_invites;
begin
    select * into invite_row from public.studio_invites
    where token_hash = p_token_hash
      and email = lower(trim(p_email))
      and accepted_at is null
      and revoked_at is null
      and expires_at > now()
    for update;

    if not found then
        raise exception 'invalid or expired invitation' using errcode = '22023';
    end if;

    insert into public.profiles (id) values (p_actor_id)
    on conflict (id) do nothing;

    insert into public.studio_members (studio_id, user_id, role)
    values (invite_row.studio_id, p_actor_id, invite_row.role)
    on conflict (studio_id, user_id) do nothing;

    update public.studio_invites set accepted_at = now() where id = invite_row.id;
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (invite_row.studio_id, p_actor_id, 'invite.accepted', 'invite', invite_row.id::text);
    return invite_row.studio_id;
end;
$$;

revoke all on function public.admin_accept_studio_invite(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_accept_studio_invite(uuid, text, text) to service_role;
notify pgrst, 'reload schema';
