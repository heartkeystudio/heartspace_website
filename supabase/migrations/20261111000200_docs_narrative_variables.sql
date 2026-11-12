-- HeartSpace Docs: variáveis tipadas usadas por condições e efeitos narrativos.

alter table public.project_narrative_registry
  add column if not exists variables jsonb not null default '[]'::jsonb;

alter table public.project_narrative_registry
  drop constraint if exists project_narrative_registry_variables_array;

alter table public.project_narrative_registry
  add constraint project_narrative_registry_variables_array
  check (jsonb_typeof(variables) = 'array');

comment on column public.project_narrative_registry.variables is
  'Variáveis tipadas compartilhadas pelo simulador e pelos runtimes narrativos.';
