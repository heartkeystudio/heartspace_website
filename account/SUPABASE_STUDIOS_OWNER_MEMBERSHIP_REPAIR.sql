-- Recupera estúdios antigos do Hub cujo owner_id não foi sincronizado em studio_members.
-- Também permite ao owner consultar o próprio estúdio enquanto a associação é reparada.
begin;

alter table public.studios
    add column if not exists owner_id uuid references auth.users(id) on delete restrict;

update public.studios
set owner_id = created_by
where owner_id is null and created_by is not null;

update public.studios
set created_by = owner_id
where created_by is null and owner_id is not null;

drop policy if exists "members read their studios" on public.studios;
drop policy if exists "members and owners read their studios" on public.studios;
create policy "members and owners read their studios"
    on public.studios for select to authenticated
    using (public.is_studio_member(id) or owner_id = auth.uid());

insert into public.studio_members (studio_id, user_id, role)
select id, owner_id, 'owner'
from public.studios
where owner_id is not null
on conflict (studio_id, user_id)
do update set role = 'owner'
where public.studio_members.role is distinct from 'owner';

notify pgrst, 'reload schema';
commit;
