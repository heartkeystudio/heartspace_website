-- Imagens privadas do Docs, acessíveis somente a integrantes com permissão
-- de leitura ou edição no projeto correspondente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('docs-assets', 'docs-assets', false, 12582912, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists docs_assets_read_project on storage.objects;
create policy docs_assets_read_project on storage.objects
  for select to authenticated
  using (
    bucket_id = 'docs-assets'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and public.heartspace_has_project_capability(p.id, 'docs_view')
    )
  );

drop policy if exists docs_assets_insert_project on storage.objects;
create policy docs_assets_insert_project on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'docs-assets'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and public.heartspace_has_project_capability(p.id, 'docs_edit')
    )
  );

drop policy if exists docs_assets_delete_project on storage.objects;
create policy docs_assets_delete_project on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'docs-assets'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and public.heartspace_has_project_capability(p.id, 'docs_edit')
    )
  );
