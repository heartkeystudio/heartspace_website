-- Storage policies devem validar o projeto pela função SECURITY DEFINER.
-- Consultar public.projects diretamente faz o RLS dessa tabela ocultar projetos
-- de membros que têm acesso ao Docs, bloqueando os uploads compartilhados.
drop policy if exists docs_assets_read_project on storage.objects;
create policy docs_assets_read_project on storage.objects
  for select to authenticated
  using (
    bucket_id = 'docs-assets'
    and public.heartspace_has_project_capability(
      ((storage.foldername(name))[1])::uuid,
      'docs_view'
    )
  );

drop policy if exists docs_assets_insert_project on storage.objects;
create policy docs_assets_insert_project on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'docs-assets'
    and public.heartspace_has_project_capability(
      ((storage.foldername(name))[1])::uuid,
      'docs_edit'
    )
  );

drop policy if exists docs_assets_delete_project on storage.objects;
create policy docs_assets_delete_project on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'docs-assets'
    and public.heartspace_has_project_capability(
      ((storage.foldername(name))[1])::uuid,
      'docs_edit'
    )
  );
