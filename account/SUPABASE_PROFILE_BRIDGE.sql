-- HeartSpace: ponte para o modelo legado de profiles.
-- Aplique depois de SUPABASE_STUDIOS_COMPATIBILITY.sql.
-- studio_members possui uma FK antiga para public.profiles; garantimos um
-- profile mínimo antes de associar a conta ao estúdio.

create or replace function public.admin_create_studio(p_actor_id uuid, p_name text, p_slug text)
returns public.studios language plpgsql security definer set search_path = public as $$
declare created_studio public.studios;
begin
    if p_actor_id is null or char_length(trim(p_name)) not between 2 and 80
       or p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$' then
        raise exception 'invalid studio input' using errcode = '22023';
    end if;

    -- Os demais campos do perfil legado são opcionais. O site não inventa nem
    -- copia dados pessoais; cria somente a referência necessária à FK.
    insert into public.profiles (id) values (p_actor_id) on conflict (id) do nothing;

    insert into public.studios (name, slug, created_by, owner_id)
    values (trim(p_name), p_slug, p_actor_id, p_actor_id)
    returning * into created_studio;
    insert into public.studio_members (studio_id, user_id, role)
    values (created_studio.id, p_actor_id, 'owner');
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (created_studio.id, p_actor_id, 'studio.created', 'studio', created_studio.id::text);
    return created_studio;
end;
$$;

grant execute on function public.admin_create_studio(uuid, text, text) to service_role;
notify pgrst, 'reload schema';
