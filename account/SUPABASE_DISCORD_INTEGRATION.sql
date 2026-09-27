-- HeartSpace Discord: execute uma única vez no SQL Editor do Supabase.
-- Esta versão é idempotente e também corrige a permissão de canais para que
-- somente Owner/Admin possa alterar o vínculo de um projeto.

create table if not exists public.discord_connections (
    user_id uuid primary key references auth.users(id) on delete cascade,
    discord_user_id text not null,
    discord_username text not null default '',
    access_token_encrypted text not null,
    refresh_token_encrypted text not null,
    token_expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.studio_discord_links (
    studio_id uuid primary key references public.studios(id) on delete cascade,
    guild_id text not null,
    guild_name text not null default '',
    default_channel_id text,
    created_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.project_discord_channels (
    project_id uuid primary key references public.projects(id) on delete cascade,
    studio_id uuid not null references public.studios(id) on delete cascade,
    guild_id text not null,
    channel_id text not null,
    channel_name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.discord_connections enable row level security;
alter table public.studio_discord_links enable row level security;
alter table public.project_discord_channels enable row level security;

drop policy if exists discord_connections_owner_only on public.discord_connections;
create policy discord_connections_owner_only on public.discord_connections
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists studio_discord_links_member_read on public.studio_discord_links;
create policy studio_discord_links_member_read on public.studio_discord_links
for select to authenticated using (
    exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid())
    or exists (select 1 from public.studio_members sm where sm.studio_id = studio_id and sm.user_id = auth.uid())
);

drop policy if exists studio_discord_links_manage on public.studio_discord_links;
create policy studio_discord_links_manage on public.studio_discord_links
for all to authenticated using (
    exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid())
    or exists (select 1 from public.studio_members sm where sm.studio_id = studio_id and sm.user_id = auth.uid() and lower(coalesce(sm.role, 'member')) in ('owner', 'admin'))
)
with check (
    exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid())
    or exists (select 1 from public.studio_members sm where sm.studio_id = studio_id and sm.user_id = auth.uid() and lower(coalesce(sm.role, 'member')) in ('owner', 'admin'))
);

drop policy if exists project_discord_channels_member_access on public.project_discord_channels;
drop policy if exists project_discord_channels_member_read on public.project_discord_channels;
create policy project_discord_channels_member_read on public.project_discord_channels
for select to authenticated using (
    exists (select 1 from public.studios s where s.id = studio_id and s.owner_id = auth.uid())
    or exists (select 1 from public.studio_members sm where sm.studio_id = studio_id and sm.user_id = auth.uid())
);

create index if not exists project_discord_channels_studio_id_idx on public.project_discord_channels(studio_id);
