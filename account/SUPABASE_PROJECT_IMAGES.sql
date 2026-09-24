-- HeartSpace: capas públicas, comprimidas, para projetos.
-- A Edge Function limita o conteúdo a 1600 × 900 e 600 KB antes de gravar.

-- `cover_image` já é consumido pelo Hub como imagem de perfil do projeto.
-- A capa horizontal ganha um campo separado para não alterar esse contrato.
alter table public.projects add column if not exists banner_image text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  true,
  614400,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
