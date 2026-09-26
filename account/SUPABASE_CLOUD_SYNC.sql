-- HeartSpace: conexão de nuvem compartilhada pelo estúdio.
-- Execute depois de SUPABASE_STUDIO_SCHEMA.sql e SUPABASE_PROJECT_LIFECYCLE.sql.
-- Tokens nunca são expostos ao navegador; a Edge Function é a única leitora.

create table if not exists public.studio_cloud_connections (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  provider text not null check (provider in ('google_drive', 'dropbox', 'onedrive')),
  provider_account_id text,
  provider_account_email text,
  root_folder_id text,
  root_folder_name text,
  -- Mesmo formato cifrado usado pela Function exchange_drive_token do Hub.
  -- Assim a conexão compartilhada pode emitir access tokens sem duplicar segredo.
  refresh_token_encrypted text not null,
  scopes text[] not null default '{}',
  connected_by uuid not null references auth.users(id),
  connected_at timestamptz not null default timezone('utc', now()),
  last_validated_at timestamptz,
  revoked_at timestamptz,
  unique (studio_id, provider)
);

create table if not exists public.project_cloud_sync_configs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  connection_id uuid not null references public.studio_cloud_connections(id) on delete cascade,
  folder_id text not null,
  folder_name text not null,
  sync_enabled boolean not null default true,
  change_cursor text,
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status in ('idle', 'syncing', 'ok', 'error')) default 'idle',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cloud_oauth_states (
  state text primary key,
  studio_id uuid not null references public.studios(id) on delete cascade,
  provider text not null check (provider in ('google_drive')),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

alter table public.studio_cloud_connections enable row level security;
alter table public.project_cloud_sync_configs enable row level security;
alter table public.cloud_oauth_states enable row level security;

-- A UI lê tudo pela Edge Function. Esta política permite que membros recebam o
-- estado da sincronização do projeto sem jamais revelar o token da conexão.
drop policy if exists "project_sync_read_member" on public.project_cloud_sync_configs;
create policy "project_sync_read_member" on public.project_cloud_sync_configs for select to authenticated using (
  exists (select 1 from public.project_members pm where pm.project_id = project_cloud_sync_configs.project_id and pm.user_id = auth.uid())
  or exists (
    select 1 from public.projects p join public.studio_members sm on sm.studio_id = p.studio_id
    where p.id = project_cloud_sync_configs.project_id and sm.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
