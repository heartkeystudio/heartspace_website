-- HeartSpace: ficha completa e avatar leve da conta.
alter table public.profiles add column if not exists nickname text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 163840, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 163840,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

comment on column public.profiles.nickname is
  'Apelido de exibição da conta HeartSpace.';
