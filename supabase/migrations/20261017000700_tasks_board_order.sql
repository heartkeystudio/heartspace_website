-- Persistent ordering for the collaborative Tasks backlog, sprints, and cards.
-- Existing rows keep their current display order until a user reorders them.
alter table public.tasks
  add column if not exists sort_order integer not null default 0;

alter table public.sprints
  add column if not exists sort_order integer not null default 0;

create index if not exists tasks_project_sprint_sort_idx
  on public.tasks (project_id, sprint_id, sort_order, created_at);

create index if not exists sprints_project_sort_idx
  on public.sprints (project_id, sort_order, created_at);
