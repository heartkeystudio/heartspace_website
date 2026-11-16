-- One game canvas shared by every sequence in the project.
alter table public.project_narrative_registry
  add column if not exists scene_settings jsonb default null;

alter table public.project_narrative_registry
  drop constraint if exists project_narrative_registry_scene_settings_object;
alter table public.project_narrative_registry
  add constraint project_narrative_registry_scene_settings_object
  check (scene_settings is null or jsonb_typeof(scene_settings) = 'object');

comment on column public.project_narrative_registry.scene_settings is
  'Game-wide scene viewport (aspect, width, height). Composition remains in each document sequence.';
