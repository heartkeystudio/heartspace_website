-- Reparo para instalações que executaram uma versão anterior de
-- SUPABASE_CLOUD_SYNC.sql, com token_ciphertext/token_iv.
-- A conexão nova passa a usar exatamente o formato cifrado por DRIVE_TOKEN_SECRET.

alter table public.studio_cloud_connections
  add column if not exists refresh_token_encrypted text;

-- As colunas antigas podem continuar existindo em instalações de teste, mas a
-- nova Edge Function não as preenche. Retirar NOT NULL evita falha no upsert.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'studio_cloud_connections' and column_name = 'token_ciphertext'
  ) then
    execute 'alter table public.studio_cloud_connections alter column token_ciphertext drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'studio_cloud_connections' and column_name = 'token_iv'
  ) then
    execute 'alter table public.studio_cloud_connections alter column token_iv drop not null';
  end if;
end;
$$;

notify pgrst, 'reload schema';
