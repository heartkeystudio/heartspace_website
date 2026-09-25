-- HeartSpace: reparo idempotente da ficha de perfil.
-- Execute no SQL Editor se salvar a ficha retornar erro.

alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists profession text;
alter table public.profiles add column if not exists profile_completed_at timestamptz;
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_profession_length;
alter table public.profiles add constraint profiles_profession_length
  check (profession is null or char_length(trim(profession)) between 2 and 120);

notify pgrst, 'reload schema';
