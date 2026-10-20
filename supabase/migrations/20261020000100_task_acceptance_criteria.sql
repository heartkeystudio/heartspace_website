-- Tasks: critérios de aceite com aprovação registrada antes da conclusão.
alter table public.tasks
  add column if not exists acceptance_criteria jsonb not null default '[]'::jsonb;

-- Owners e admins aprovam sempre; estes cargos de gestão recebem a permissão
-- por padrão nos projetos que já usam esses modelos.
update public.projects
set role_permissions =
  jsonb_set(role_permissions, '{game_designer}', (role_permissions->'game_designer') || '{"tasks_approve":true}'::jsonb, true)
where role_permissions ? 'game_designer';
update public.projects
set role_permissions =
  jsonb_set(role_permissions, '{producer}', (role_permissions->'producer') || '{"tasks_approve":true}'::jsonb, true)
where role_permissions ? 'producer';
update public.projects
set role_permissions =
  jsonb_set(role_permissions, '{direction}', (role_permissions->'direction') || '{"tasks_approve":true}'::jsonb, true)
where role_permissions ? 'direction';
update public.projects
set role_permissions =
  jsonb_set(role_permissions, '{production}', (role_permissions->'production') || '{"tasks_approve":true}'::jsonb, true)
where role_permissions ? 'production';
update public.projects
set role_permissions =
  jsonb_set(role_permissions, '{management}', (role_permissions->'management') || '{"tasks_approve":true}'::jsonb, true)
where role_permissions ? 'management';

create or replace function public.heartspace_guard_task_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  criterion jsonb;
  previous_criterion jsonb;
  criterion_id text;
  can_approve boolean := false;
  approval_changed boolean;
  was_done boolean := false;
begin
  can_approve := public.heartspace_has_project_capability(new.project_id, 'tasks_approve')
    or exists (
      select 1 from public.projects p
      left join public.studio_members sm on sm.studio_id = p.studio_id and sm.user_id = auth.uid()
      where p.id = new.project_id and (p.owner_id = auth.uid() or sm.role in ('owner', 'admin'))
    );

  if tg_op = 'UPDATE' then
    was_done := old.status in ('done', 'completed', 'fechado');
    for criterion in select value from jsonb_array_elements(coalesce(new.acceptance_criteria, '[]'::jsonb)) loop
      criterion_id := criterion->>'id';
      select value into previous_criterion
      from jsonb_array_elements(coalesce(old.acceptance_criteria, '[]'::jsonb))
      where value->>'id' = criterion_id limit 1;

      approval_changed := coalesce(criterion->>'approved_at', '') <> coalesce(previous_criterion->>'approved_at', '')
        or coalesce(criterion->>'approved_by', '') <> coalesce(previous_criterion->>'approved_by', '');
      if approval_changed and (criterion->>'approved_at' is not null or criterion->>'approved_by' is not null) then
        if not can_approve or criterion->>'approved_by' is distinct from auth.uid()::text or criterion->>'approved_at' is null then
          raise exception 'Somente a gestão do projeto pode aprovar critérios de aceite.' using errcode = '42501';
        end if;
      end if;
      if previous_criterion is not null
        and coalesce(criterion->>'text', '') <> coalesce(previous_criterion->>'text', '')
        and (criterion->>'approved_at' is not null or criterion->>'approved_by' is not null) then
        raise exception 'Um critério alterado precisa de nova aprovação.' using errcode = '23514';
      end if;
      previous_criterion := null;
    end loop;
  else
    for criterion in select value from jsonb_array_elements(coalesce(new.acceptance_criteria, '[]'::jsonb)) loop
      if criterion->>'approved_at' is not null or criterion->>'approved_by' is not null then
        if not can_approve or criterion->>'approved_by' is distinct from auth.uid()::text or criterion->>'approved_at' is null then
          raise exception 'Somente a gestão do projeto pode aprovar critérios de aceite.' using errcode = '42501';
        end if;
      end if;
    end loop;
  end if;

  if new.status in ('done', 'completed', 'fechado') and not was_done then
    if jsonb_typeof(new.acceptance_criteria) <> 'array' or jsonb_array_length(new.acceptance_criteria) = 0 then
      raise exception 'Adicione critérios de aceite antes de concluir a tarefa.' using errcode = '23514';
    end if;
    if exists (
      select 1 from jsonb_array_elements(new.acceptance_criteria) item
      where length(trim(coalesce(item->>'text', ''))) = 0
        or item->>'approved_at' is null or item->>'approved_by' is null
    ) then
      raise exception 'A gestão precisa aprovar todos os critérios antes de concluir a tarefa.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists heartspace_tasks_acceptance_guard on public.tasks;
create trigger heartspace_tasks_acceptance_guard
before insert or update on public.tasks
for each row execute function public.heartspace_guard_task_acceptance();

revoke all on function public.heartspace_guard_task_acceptance() from public, anon;
