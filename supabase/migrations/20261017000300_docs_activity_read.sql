-- Permite ao Docs mostrar a última edição para quem já pode ler o documento.
grant select on table public.doc_activity to authenticated;
drop policy if exists docs_activity_read_project on public.doc_activity;
create policy docs_activity_read_project on public.doc_activity
  for select to authenticated
  using (
    exists (
      select 1 from public.docs d
      where d.id = doc_id
        and public.heartspace_has_project_capability(d.project_id, 'docs_view')
    )
  );
