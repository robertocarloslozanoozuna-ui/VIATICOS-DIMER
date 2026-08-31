-- Multi-role support without changing the existing users.role / users.role_id contract.
-- Safe to run more than once.
create table if not exists public.user_roles (
  user_id text not null references public.users(id) on delete cascade,
  role_id text not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_role_id on public.user_roles(role_id);

-- Preserve every existing single-role assignment.
insert into public.user_roles (user_id, role_id)
select u.id, u.role_id
from public.users u
where u.role_id is not null
on conflict (user_id, role_id) do nothing;

-- Keep direct client access disabled; backend uses the Supabase service role.
alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon, authenticated;
