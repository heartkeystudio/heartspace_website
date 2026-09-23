-- HeartSpace: permissão exclusiva das Edge Functions.
-- Aplique depois de SUPABASE_STUDIO_SCHEMA.sql.
-- Isso não concede execução para anon/authenticated; somente a Function, que
-- usa a service role internamente, pode criar ou alterar dados administrativos.

grant execute on function public.admin_create_studio(uuid, text, text) to service_role;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.profiles, public.studios,
    public.studio_members, public.studio_invites, public.studio_projects,
    public.studio_audit_log to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Estas duas grants entram em vigor após a migration de convites ser aplicada.
do $$
begin
    if to_regprocedure('public.admin_create_studio_invite(uuid,uuid,text,text,text,timestamp with time zone)') is not null then
        grant execute on function public.admin_create_studio_invite(uuid, uuid, text, text, text, timestamptz) to service_role;
    end if;
    if to_regprocedure('public.admin_accept_studio_invite(uuid,text,text)') is not null then
        grant execute on function public.admin_accept_studio_invite(uuid, text, text) to service_role;
    end if;
end;
$$;
