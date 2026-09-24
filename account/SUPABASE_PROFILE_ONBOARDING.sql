-- HeartSpace: ficha de perfil no primeiro acesso ao portal.
-- Aplique depois de SUPABASE_PROFILE_AUTH_SYNC.sql.
-- Os dados permanecem privados em public.profiles e não são exibidos por
-- padrão para outros membros do estúdio.

alter table public.profiles add column if not exists profession text;
alter table public.profiles add column if not exists profile_completed_at timestamptz;

alter table public.profiles drop constraint if exists profiles_profession_length;
alter table public.profiles add constraint profiles_profession_length
    check (profession is null or char_length(trim(profession)) between 2 and 120);

notify pgrst, 'reload schema';
