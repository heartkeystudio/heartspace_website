-- HeartSpace: compatibilidade com a tabela public.studios já existente.
-- Preserva os dados antigos e adapta a tabela ao gerenciador de estúdios.
-- Aplique depois de SUPABASE_STUDIO_SCHEMA.sql.

alter table public.studios add column if not exists slug text;
alter table public.studios add column if not exists created_by uuid references auth.users(id) on delete restrict;
alter table public.studios add column if not exists updated_at timestamptz not null default now();
-- SUPABASE_STUDIO_SCHEMA.sql instala o trigger genérico set_updated_at também
-- em profiles. A tabela legada precisa desta coluna para que qualquer update
-- de perfil (inclusive o backfill de Auth) não falhe no trigger.
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Registros legados recebem um endereço estável, sem alterar nome, descrição,
-- logo, heartbeats ou owner_id existentes.
update public.studios
set slug = 'legacy-' || replace(id::text, '-', '')
where slug is null or trim(slug) = '';

update public.studios
set created_by = owner_id
where created_by is null and owner_id is not null;

alter table public.studios alter column slug set not null;
create unique index if not exists studios_slug_unique_idx on public.studios(slug);

-- Substitui a transação anterior para registrar tanto o owner legado quanto o
-- criador novo. created_by permanece opcional somente para não invalidar dados
-- legados cujo owner_id já estivesse vazio.
create or replace function public.admin_create_studio(p_actor_id uuid, p_name text, p_slug text)
returns public.studios language plpgsql security definer set search_path = public as $$
declare created_studio public.studios;
begin
    if p_actor_id is null or char_length(trim(p_name)) not between 2 and 80
       or p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$' then
        raise exception 'invalid studio input' using errcode = '22023';
    end if;
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
