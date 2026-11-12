-- HeartSpace Docs: glossário compartilhado usado pela localização dos documentos.

alter table public.project_narrative_registry
  add column if not exists glossary jsonb not null default '[]'::jsonb;

alter table public.project_narrative_registry
  drop constraint if exists project_narrative_registry_glossary_array;

alter table public.project_narrative_registry
  add constraint project_narrative_registry_glossary_array
  check (jsonb_typeof(glossary) = 'array');

comment on column public.project_narrative_registry.glossary is
  'Termos de localização, traduções preferidas por idioma e notas compartilhadas pelo projeto.';
