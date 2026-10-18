-- Record when a collaborative Tasks sprint is finalized.
alter table public.sprints
  add column if not exists completed_at timestamptz;
