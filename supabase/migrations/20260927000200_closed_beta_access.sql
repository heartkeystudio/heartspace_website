-- Beta fechado do HeartSpace.
-- A autenticação continua sendo feita pelo Supabase, mas somente pessoas nesta
-- lista podem usar ações autenticadas do site e do Hub.

create table if not exists public.beta_access (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'approved' check (status in ('approved', 'revoked')),
  invited_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  last_access_at timestamptz,
  notes text,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (email)
);

create index if not exists beta_access_user_id_idx on public.beta_access (user_id);
create index if not exists beta_access_status_idx on public.beta_access (status);

alter table public.beta_access enable row level security;
revoke all on table public.beta_access from anon, authenticated;

-- Pessoas que já participavam de algum estúdio continuam no beta, para que o
-- lançamento da trava não interrompa os testes em curso. Convites novos são
-- incluídos manualmente na tabela (sempre com e-mail em minúsculas).
insert into public.beta_access (email, user_id, status, approved_at)
select lower(u.email), u.id, 'approved', timezone('utc', now())
from auth.users u
where u.email is not null
  and exists (
    select 1 from public.studio_members sm where sm.user_id = u.id
  )
on conflict (email) do update
set user_id = excluded.user_id,
    status = 'approved',
    approved_at = coalesce(public.beta_access.approved_at, excluded.approved_at),
    updated_at = timezone('utc', now());
