-- HeartSpace: administração de conta, estúdios e membros.
-- Aplique como migration pelo projeto Supabase antes de ligar as ações da interface.
-- Esta migration guarda identidade, organização, acesso e referências; nunca arquivos locais.
-- Convites, pareamento do Hub e mudanças de papel passam por Edge Functions autenticadas.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text check (char_length(display_name) between 1 and 80),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.studios (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$'),
    name text not null check (char_length(name) between 2 and 80),
    created_by uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.studio_members (
    studio_id uuid not null references public.studios(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('owner', 'admin', 'member')),
    created_at timestamptz not null default now(),
    primary key (studio_id, user_id)
);

-- Nunca armazene o token puro de convite. A Edge Function guarda somente seu hash.
create table if not exists public.studio_invites (
    id uuid primary key default gen_random_uuid(),
    studio_id uuid not null references public.studios(id) on delete cascade,
    email text not null check (email = lower(email) and char_length(email) <= 320),
    role text not null check (role in ('admin', 'member')),
    token_hash text not null unique,
    created_by uuid not null references auth.users(id) on delete restrict,
    expires_at timestamptz not null,
    accepted_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (expires_at > created_at)
);

-- Referência opcional de projeto vindo do Hub; nunca inclua documentos ou paths locais.
create table if not exists public.studio_projects (
    id uuid primary key default gen_random_uuid(),
    studio_id uuid not null references public.studios(id) on delete cascade,
    hub_project_id uuid not null unique,
    title text not null check (char_length(title) between 1 and 140),
    created_by uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Auditoria mínima: não grave tokens, documentos, e-mails completos ou payloads desnecessários.
create table if not exists public.studio_audit_log (
    id bigint generated always as identity primary key,
    studio_id uuid not null references public.studios(id) on delete cascade,
    actor_id uuid references auth.users(id) on delete set null,
    action text not null check (char_length(action) between 1 and 80),
    target_type text check (char_length(target_type) <= 40),
    target_id text check (char_length(target_id) <= 100),
    created_at timestamptz not null default now()
);

create index if not exists studio_members_user_id_idx on public.studio_members(user_id);
create index if not exists studio_invites_studio_id_idx on public.studio_invites(studio_id);
create index if not exists studio_invites_pending_email_idx on public.studio_invites(email) where accepted_at is null and revoked_at is null;
create index if not exists studio_projects_studio_id_idx on public.studio_projects(studio_id);
create index if not exists studio_audit_log_studio_id_created_at_idx on public.studio_audit_log(studio_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists studios_set_updated_at on public.studios;
create trigger studios_set_updated_at before update on public.studios for each row execute function public.set_updated_at();
drop trigger if exists studio_projects_set_updated_at on public.studio_projects;
create trigger studio_projects_set_updated_at before update on public.studio_projects for each row execute function public.set_updated_at();

create or replace function public.is_studio_member(p_studio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.studio_members where studio_id = p_studio_id and user_id = auth.uid());
$$;

create or replace function public.is_studio_admin(p_studio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.studio_members where studio_id = p_studio_id and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

alter table public.profiles enable row level security;
alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
alter table public.studio_invites enable row level security;
alter table public.studio_projects enable row level security;
alter table public.studio_audit_log enable row level security;

create policy "profile owner reads own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profile owner creates own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profile owner updates own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "members read their studios" on public.studios for select to authenticated using (public.is_studio_member(id));
create policy "members read studio roster" on public.studio_members for select to authenticated using (public.is_studio_member(studio_id));
create policy "members read studio projects" on public.studio_projects for select to authenticated using (public.is_studio_member(studio_id));
create policy "admins read studio invites" on public.studio_invites for select to authenticated using (public.is_studio_admin(studio_id));
create policy "members read studio audit events" on public.studio_audit_log for select to authenticated using (public.is_studio_member(studio_id));

-- Transação usada exclusivamente pela Edge Function heartspace-studios.
-- Não conceda EXECUTE a anon/authenticated: o navegador não pode chamar isso.
create or replace function public.admin_create_studio(p_actor_id uuid, p_name text, p_slug text)
returns public.studios language plpgsql security definer set search_path = public as $$
declare created_studio public.studios;
begin
    if p_actor_id is null or char_length(trim(p_name)) not between 2 and 80
       or p_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$' then
        raise exception 'invalid studio input' using errcode = '22023';
    end if;
    insert into public.studios (name, slug, created_by)
    values (trim(p_name), p_slug, p_actor_id)
    returning * into created_studio;
    insert into public.studio_members (studio_id, user_id, role)
    values (created_studio.id, p_actor_id, 'owner');
    insert into public.studio_audit_log (studio_id, actor_id, action, target_type, target_id)
    values (created_studio.id, p_actor_id, 'studio.created', 'studio', created_studio.id::text);
    return created_studio;
end;
$$;

-- Sem políticas diretas de INSERT/UPDATE/DELETE para estúdios, membros, convites,
-- projetos ou auditoria. Mutações são exclusivas de Edge Functions que validam JWT,
-- papel, limites de plano e registro de auditoria.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.studios, public.studio_members, public.studio_invites, public.studio_projects, public.studio_audit_log to authenticated;
revoke all on function public.is_studio_member(uuid) from public;
revoke all on function public.is_studio_admin(uuid) from public;
grant execute on function public.is_studio_member(uuid), public.is_studio_admin(uuid) to authenticated;
revoke all on function public.admin_create_studio(uuid, text, text) from public, anon, authenticated;
