-- HeartSpace: ícones públicos e pequenos para estúdios.
-- O upload é feito pela Edge Function depois de reduzir a imagem para 64 × 64.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-icons',
  'studio-icons',
  true,
  98304,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
