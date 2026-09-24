-- HeartSpace: sincronização não destrutiva entre auth.users e profiles legado.
-- Aplique depois de SUPABASE_PROFILE_BRIDGE.sql.
--
-- O Hub ainda usa public.profiles para nome, e-mail, idade e telefone. A ponte
-- anterior criou apenas o id para satisfazer a FK de studio_members; este
-- migration completa os campos que Auth já conhece e preserva dados que o Hub
-- já tenha gravado (idade, telefone, avatar, XP etc.).

-- O schema moderno adiciona um trigger genérico de updated_at. A tabela legado
-- não possuía essa coluna, então ela precisa existir antes de qualquer upsert.
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.auth_profile_name(p_metadata jsonb)
returns text language sql immutable set search_path = public as $$
    select nullif(trim(coalesce(
        nullif(p_metadata ->> 'full_name', ''),
        nullif(p_metadata ->> 'name', ''),
        nullif(p_metadata ->> 'display_name', ''),
        nullif(trim(concat_ws(' ', p_metadata ->> 'first name', p_metadata ->> 'second name')), ''),
        nullif(p_metadata ->> 'username', '')
    )), '');
$$;

create or replace function public.auth_profile_age(p_metadata jsonb)
returns integer language sql immutable set search_path = public as $$
    select case
        when coalesce(p_metadata ->> 'age', '') ~ '^[0-9]{1,3}$'
             and (p_metadata ->> 'age')::integer between 0 and 130
        then (p_metadata ->> 'age')::integer
        else null
    end;
$$;

create or replace function public.sync_auth_user_profile()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
    insert into public.profiles (id, email, full_name, age, phone)
    values (
        new.id,
        nullif(lower(trim(coalesce(new.email, ''))), ''),
        public.auth_profile_name(metadata),
        public.auth_profile_age(metadata),
        coalesce(nullif(trim(coalesce(new.phone, '')), ''), nullif(trim(coalesce(metadata ->> 'phone', '')), ''))
    )
    on conflict (id) do update set
        email = coalesce(nullif(public.profiles.email, ''), excluded.email),
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
        age = coalesce(public.profiles.age, excluded.age),
        phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone);
    return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of email, phone, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_profile();

-- Corrige as contas que já existiam antes do trigger.
insert into public.profiles (id, email, full_name, age, phone)
select
    u.id,
    nullif(lower(trim(coalesce(u.email, ''))), ''),
    public.auth_profile_name(coalesce(u.raw_user_meta_data, '{}'::jsonb)),
    public.auth_profile_age(coalesce(u.raw_user_meta_data, '{}'::jsonb)),
    coalesce(nullif(trim(coalesce(u.phone, '')), ''), nullif(trim(coalesce(u.raw_user_meta_data ->> 'phone', '')), ''))
from auth.users u
on conflict (id) do update set
    email = coalesce(nullif(public.profiles.email, ''), excluded.email),
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    age = coalesce(public.profiles.age, excluded.age),
    phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone);

notify pgrst, 'reload schema';
