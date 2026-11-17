-- Let the invited person review a studio invitation from their HeartSpace account.
-- The invitation remains email-bound; these fields are only used by the trusted
-- heartspace-studio Edge Function.
begin;

alter table public.studio_invites
  add column if not exists recipient_id uuid references auth.users(id) on delete cascade,
  add column if not exists viewed_at timestamptz,
  add column if not exists declined_at timestamptz;

create index if not exists studio_invites_recipient_pending_idx
  on public.studio_invites(recipient_id, created_at desc)
  where accepted_at is null and revoked_at is null and declined_at is null;

create or replace function public.admin_decline_studio_invite(
  p_actor_id uuid,
  p_invite_id uuid,
  p_email text
) returns void
language plpgsql security definer set search_path = public as $$
declare invite_row public.studio_invites;
begin
  select * into invite_row
  from public.studio_invites
  where id = p_invite_id
    and email = lower(trim(p_email))
    and accepted_at is null
    and revoked_at is null
    and declined_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid or expired invitation' using errcode = '22023';
  end if;

  update public.studio_invites set declined_at = now() where id = invite_row.id;
  insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
  values (invite_row.studio_id, p_actor_id, 'invite.declined', 'invite', invite_row.id::text);
end;
$$;

revoke all on function public.admin_decline_studio_invite(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_decline_studio_invite(uuid, uuid, text) to service_role;

commit;
